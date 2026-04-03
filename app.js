// ==========================================
// 1. INITIALISATION DE LA BASE DE DONNÉES (IndexedDB)
// ==========================================
let db;
const request = indexedDB.open("SynutriDB", 1);

request.onupgradeneeded = (event) => {
    db = event.target.result;
    if (!db.objectStoreNames.contains("aliments")) {
        db.createObjectStore("aliments", { keyPath: "id" });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log("Base de données Synutri prête !");
    chargerAlimentsFavoris(); // Charge les données au démarrage
};

request.onerror = (event) => {
    console.error("Erreur IndexedDB :", event.target.errorCode);
};

// ==========================================
// 2. GESTION DE L'INTERFACE & VERSION
// ==========================================

// Affichage du numéro de version (provenant de version.js)
if (typeof VERSION !== 'undefined') {
    document.getElementById('app-version').innerText = VERSION;
}

// Menu latéral (Sidebar)
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('overlay');
    const open = sb.style.left === "0px";
    sb.style.left = open ? "-290px" : "0px";
    ov.style.display = open ? "none" : "block";
}

// Navigation entre les vues (Dashboard / Recherche)
function showView(viewName) {
    const dash = document.getElementById('dash-view');
    const search = document.getElementById('search-section');
    const navDash = document.getElementById('nav-dash');
    const navSearch = document.getElementById('nav-search');

    if (viewName === 'dash') {
        dash.style.display = 'block';
        search.style.display = 'none';
        navDash.classList.add('active');
        navSearch.classList.remove('active');
        chargerAlimentsFavoris(); // Rafraîchir la liste en revenant
    } else if (viewName === 'search') {
        dash.style.display = 'none';
        search.style.display = 'block';
        navDash.classList.remove('active');
        navSearch.classList.add('active');
    }
    
    // Fermer le sidebar si ouvert
    const sb = document.getElementById('sidebar');
    if (sb.style.left === "0px") toggleSidebar();
}

// Système de mise à jour forcée (Méthode radicale)
async function forceUpdate() {
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
            await registration.unregister();
        }
        
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));

        alert("Synutri va redémarrer sur la dernière version.");

        const cleanUrl = window.location.origin + window.location.pathname + '?refresh=' + Date.now();
        window.location.href = cleanUrl;
    }
}

// ==========================================
// 3. JALON 2 : RECHERCHE & API
// ==========================================

async function rechercherAliment() {
    const query = document.getElementById('search-input').value;
    const resultsDiv = document.getElementById('search-results');
    
    if (query.length < 3) {
        alert("Tape au moins 3 lettres !");
        return;
    }

    resultsDiv.innerHTML = "<p style='text-align:center;'>🔍 Recherche en cours...</p>";

    try {
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`;
        
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Synutri - App - Version ' + (typeof VERSION !== 'undefined' ? VERSION : '1.0')
            }
        });

        if (!response.ok) throw new Error("Erreur serveur");

        const data = await response.json();
        resultsDiv.innerHTML = ""; 

        if (!data.products || data.products.length === 0) {
            resultsDiv.innerHTML = "<p>Aucun résultat trouvé.</p>";
            return;
        }

        data.products.forEach(product => {
            const name = product.product_name_fr || product.product_name || "Produit inconnu";
            const brand = product.brands || "Marque inconnue";
            const image = product.image_front_small_url || "https://via.placeholder.com/50";

            const card = document.createElement('div');
            card.className = 'card';
            card.style = "display:flex; align-items:center; gap:15px; margin-bottom:10px; text-align:left; padding:12px; border:1px solid #eee; border-radius:15px;";

            card.innerHTML = `
                <img src="${image}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;">
                <div style="flex:1;">
                    <strong style="font-size:0.9rem;">${name}</strong><br>
                    <span style="font-size:0.75rem; color:#718096;">${brand}</span>
                </div>
                <button onclick="ajouterAlimentLocal('${product.code}', '${name.replace(/'/g, "\\'")}')" 
                        style="background:var(--prim); color:white; border:none; padding:10px; border-radius:10px; cursor:pointer;">
                    +
                </button>
            `;
            resultsDiv.appendChild(card);
        });
    } catch (error) {
        resultsDiv.innerHTML = `<p style="color:red; text-align:center;">❌ Erreur de connexion API.</p>`;
        console.error("Erreur API:", error);
    }
}

// Sauvegarde dans IndexedDB
function ajouterAlimentLocal(id, name) {
    if (!db) return;

    const transaction = db.transaction(["aliments"], "readwrite");
    const store = transaction.objectStore("aliments");

    const nouvelAliment = {
        id: id,
        nom: name,
        dateAjout: new Date().toISOString()
    };

    const requestAdd = store.add(nouvelAliment);

    requestAdd.onsuccess = () => {
        alert(`✅ ${name} ajouté !`);
        showView('dash');
    };

    requestAdd.onerror = () => {
        alert("Cet aliment est déjà enregistré.");
    };
}

// Affichage des favoris sur le Dashboard
function chargerAlimentsFavoris() {
    if (!db) return;

    const transaction = db.transaction(["aliments"], "readonly");
    const store = transaction.objectStore("aliments");
    const requestGet = store.getAll();

    requestGet.onsuccess = () => {
        const aliments = requestGet.result;
        const dashView = document.getElementById('dash-view');
        
        let htmlListe = '<h3 style="margin-top:25px; text-align:left;">Mes derniers ajouts</h3>';
        
        if (aliments.length === 0) {
            htmlListe += '<p style="color:#a0aec0; font-size:0.9rem;">Aucun aliment enregistré.</p>';
        } else {
            // Affichage des 5 derniers
            [...aliments].reverse().slice(0, 5).forEach(alim => {
                htmlListe += `
                    <div class="card" style="margin-bottom:10px; padding:15px; text-align:left; display:flex; justify-content:space-between; align-items:center; border-radius:15px;">
                        <span style="font-weight:500;">${alim.nom}</span>
                        <span style="font-size:0.7rem; color:#cbd5e0;">${new Date(alim.dateAjout).toLocaleDateString()}</span>
                    </div>
                `;
            });
        }
        
        const oldList = document.getElementById('ma-liste-aliments');
        if (oldList) oldList.remove();
        
        const listDiv = document.createElement('div');
        listDiv.id = 'ma-liste-aliments';
        listDiv.innerHTML = htmlListe;
        dashView.appendChild(listDiv);
    };
}

// ==========================================
// 4. GRAPHIQUE (Dashboard)
// ==========================================
const chartOptions = {
    series: [65, 40, 20],
    chart: { height: 350, type: 'radialBar' },
    colors: ['#38b2ac', '#ed8936', '#4299e1'],
    labels: ['Protéines', 'Sel', 'Sucres'],
    plotOptions: {
        radialBar: { hollow: { size: '45%' }, track: { margin: 10 } }
    }
};
new ApexCharts(document.querySelector("#pantry-chart"), chartOptions).render();

// ==========================================
// 5. INSTALLATION PWA
// ==========================================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-container').style.display = 'block';
});

document.getElementById('btn-install').addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt = null;
        document.getElementById('install-container').style.display = 'none';
    }
});

