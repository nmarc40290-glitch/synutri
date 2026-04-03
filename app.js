
let db;
const request = indexedDB.open("SynutriDB", 1);

request.onupgradeneeded = (event) => {
    db = event.target.result;
    // On crée un magasin d'objets "aliments" avec l'ID (ou code-barres) comme clé
    if (!db.objectStoreNames.contains("aliments")) {
        db.createObjectStore("aliments", { keyPath: "id" });
    }
};

request.onsuccess = (event) => {
    db = event.target.result;
    console.log("Base de données Synutri prête !");
    chargerAlimentsFavoris(); // <-- AJOUTE CETTE LIGNE ICI
};


// Affiche la version depuis version.js
document.getElementById('app-version').innerText = VERSION;

// --- GRAPHIQUE ---
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

// --- UI FUNCTIONS ---
function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('overlay');
    const open = sb.style.left === "0px";
    sb.style.left = open ? "-290px" : "0px";
    ov.style.display = open ? "none" : "block";
}

async function forceUpdate() {
    if ('serviceWorker' in navigator) {
        // 1. Désenregistrement de tous les Service Workers
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
            await registration.unregister();
        }
        
        // 2. Nettoyage total des caches
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));

        alert("Mise à jour prête. Synutri va redémarrer sur la dernière version.");

        // 3. LA MÉTHODE RADICALE : Redirection vers une URL avec un paramètre unique
        // On force le navigateur à oublier l'état actuel de la page.
        const cleanUrl = window.location.origin + window.location.pathname + '?refresh=' + Date.now();
        window.location.href = cleanUrl;
    }
}


// --- PWA INSTALL ---
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

// --- NAVIGATION ENTRE LES VUES ---
function showView(viewName) {
    const dash = document.querySelector('.container');
    const search = document.getElementById('search-section');
    const navItems = document.querySelectorAll('.nav-item');

    // On cache tout
    dash.style.display = 'none';
    search.style.display = 'none';
    navItems.forEach(item => item.classList.remove('active'));

    // On affiche la vue demandée
    if (viewName === 'dash') {
        dash.style.display = 'block';
        navItems[0].classList.add('active');
    } else if (viewName === 'search') {
        search.style.display = 'block';
        navItems[2].classList.add('active'); // L'item "Scanner"
    }
}

// --- JALON 2 : MOTEUR DE RECHERCHE ---
async function rechercherAliment() {
    const query = document.getElementById('search-input').value;
    const resultsDiv = document.getElementById('search-results');
    
    if (query.length < 3) {
        alert("Tape au moins 3 lettres pour chercher !");
        return;
    }

    resultsDiv.innerHTML = "<p style='text-align:center;'>🔍 Recherche en cours...</p>";

    try {
        // Appel à l'API OpenFoodFacts
        const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${query}&search_simple=1&action=process&json=1&page_size=10`;
        const response = await fetch(url);
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
            card.style = "display:flex; align-items:center; gap:15px; margin-bottom:10px; text-align:left; padding:12px;";

            card.innerHTML = `
                <img src="${image}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;">
                <div style="flex:1;">
                    <strong style="font-size:0.9rem;">${name}</strong><br>
                    <span style="font-size:0.75rem; color:#718096;">${brand}</span>
                </div>
                <button onclick="ajouterAlimentLocal('${product.code}', '${name.replace(/'/g, "\\'")}')" 
                        style="background:var(--prim); color:white; border:none; padding:10px; border-radius:10px; cursor:pointer; font-weight:bold;">
                    +
                </button>
            `;
            resultsDiv.appendChild(card);
        });
    } catch (error) {
        resultsDiv.innerHTML = "<p>Erreur de connexion.</p>";
    }
}

// --- JALON 2 : STOCKAGE DANS LE TÉLÉPHONE ---
function ajouterAlimentLocal(id, name) {
    if (!db) {
        alert("Base de données en cours d'initialisation...");
        return;
    }

    const transaction = db.transaction(["aliments"], "readwrite");
    const store = transaction.objectStore("aliments");

    const nouvelAliment = {
        id: id,
        nom: name,
        dateAjout: new Date().toISOString()
    };

    const request = store.add(nouvelAliment);

    request.onsuccess = () => {
        alert(`✅ ${name} ajouté !`);
        showView('dash'); // On retourne voir le dashboard
        chargerAlimentsFavoris(); // On rafraîchit la liste
    };

    request.onerror = () => {
        alert("Cet aliment est déjà dans tes favoris.");
    };
}

// --- JALON 2 : AFFICHAGE SUR LE DASHBOARD ---
function chargerAlimentsFavoris() {
    if (!db) return;

    const transaction = db.transaction(["aliments"], "readonly");
    const store = transaction.objectStore("aliments");
    const request = store.getAll();

    request.onsuccess = () => {
        const aliments = request.result;
        const dashView = document.getElementById('dash-view');
        
        let htmlListe = '<h3 style="margin-top:25px; text-align:left;">Mes derniers ajouts</h3>';
        
        if (aliments.length === 0) {
            htmlListe += '<p style="color:#a0aec0; font-size:0.9rem;">Ta liste est vide.</p>';
        } else {
            // On affiche les 5 derniers ajoutés
            aliments.reverse().slice(0, 5).forEach(alim => {
                htmlListe += `
                    <div class="card" style="margin-bottom:10px; padding:15px; text-align:left; display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:500;">${alim.nom}</span>
                        <span style="font-size:0.7rem; color:#cbd5e0;">${new Date(alim.dateAjout).toLocaleDateString()}</span>
                    </div>
                `;
            });
        }
        
        // Nettoyage et injection
        const oldList = document.getElementById('ma-liste-aliments');
        if (oldList) oldList.remove();
        
        const listDiv = document.createElement('div');
        listDiv.id = 'ma-liste-aliments';
        listDiv.innerHTML = htmlListe;
        dashView.appendChild(listDiv);
    };
}

