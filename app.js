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
    chargerAlimentsFavoris(); 
};

// ==========================================
// 2. INTERFACE & NAVIGATION
// ==========================================

if (typeof VERSION !== 'undefined') {
    document.getElementById('app-version').innerText = VERSION;
}

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('overlay');
    const open = sb.style.left === "0px";
    sb.style.left = open ? "-290px" : "0px";
    ov.style.display = open ? "none" : "block";
}

function showView(viewName) {
    const dash = document.getElementById('dash-view');
    const search = document.getElementById('search-section');
    const navItems = document.querySelectorAll('.nav-item');

    dash.style.display = (viewName === 'dash') ? 'block' : 'none';
    search.style.display = (viewName === 'search') ? 'block' : 'none';

    navItems.forEach(item => item.classList.remove('active'));
    if (viewName === 'dash') {
        document.getElementById('nav-dash').classList.add('active');
        chargerAlimentsFavoris();
    } else {
        document.getElementById('nav-search').classList.add('active');
    }
    
    const sb = document.getElementById('sidebar');
    if (sb.style.left === "0px") toggleSidebar();
}

async function forceUpdate() {
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) { await registration.unregister(); }
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        alert("Synutri va redémarrer proprement.");
        window.location.href = window.location.origin + window.location.pathname + '?refresh=' + Date.now();
    }
}

// ==========================================
// 3. JALON 2 : RECHERCHE (OPEN FOOD FACTS)
// ==========================================

async function rechercherAliment() {
    const input = document.getElementById('search-input');
    const resultsDiv = document.getElementById('search-results');
    const query = input.value.trim();
    
    if (query.length < 3) {
        alert("Tape au moins 3 lettres !");
        return;
    }

    // On vide l'écran et on affiche le chargement
    resultsDiv.innerHTML = "<p style='text-align:center;'>🔍 Recherche de '" + query + "'...</p>";

    const url = `https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) throw new Error("Erreur réseau");

        const data = await response.json();
        resultsDiv.innerHTML = ""; 

        if (!data.products || data.products.length === 0) {
            resultsDiv.innerHTML = "<p style='text-align:center;'>Aucun produit trouvé.</p>";
            return;
        }

        data.products.forEach(product => {
            const name = product.product_name_fr || product.product_name || "Produit inconnu";
            const brand = product.brands || "Marque inconnue";
            const image = product.image_front_small_url || "https://via.placeholder.com/50";

            const card = document.createElement('div');
            card.className = 'card';
            card.style = "display:flex; align-items:center; gap:15px; margin-bottom:10px; text-align:left; padding:12px; border-radius:15px; background:white; border:1px solid #edf2f7;";

            card.innerHTML = `
                <img src="${image}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;" onerror="this.src='https://via.placeholder.com/50'">
                <div style="flex:1;">
                    <strong style="font-size:0.9rem;">${name}</strong><br>
                    <span style="font-size:0.75rem; color:#718096;">${brand}</span>
                </div>
                <button type="button" onclick="ajouterAlimentLocal('${product.code}', '${name.replace(/'/g, "\\'")}')" 
                        style="background:var(--prim); color:white; border:none; padding:10px; border-radius:10px; cursor:pointer; font-weight:bold;">
                    +
                </button>
            `;
            resultsDiv.appendChild(card);
        });
    } catch (error) {
        resultsDiv.innerHTML = `<p style="color:red; text-align:center; padding:10px;">❌ Erreur : ${error.message}</p>`;
    }
}

// ==========================================
// 4. JALON 2 : STOCKAGE ET AFFICHAGE
// ==========================================

function ajouterAlimentLocal(id, name) {
    if (!db) return;
    const transaction = db.transaction(["aliments"], "readwrite");
    const store = transaction.objectStore("aliments");
    const requestAdd = store.add({ id: id, nom: name, dateAjout: new Date().toISOString() });

    requestAdd.onsuccess = () => {
        alert(`✅ ${name} ajouté !`);
        showView('dash');
    };
    requestAdd.onerror = () => { alert("Déjà dans tes favoris."); };
}

function chargerAlimentsFavoris() {
    if (!db) return;
    const transaction = db.transaction(["aliments"], "readonly");
    const store = transaction.objectStore("aliments");
    const requestGet = store.getAll();

    requestGet.onsuccess = () => {
        const aliments = requestGet.result;
        const dashView = document.getElementById('dash-view');
        
        let html = '<h3 style="margin-top:25px; text-align:left;">Mes derniers ajouts</h3>';
        if (aliments.length === 0) {
            html += '<p style="color:#a0aec0; font-size:0.9rem; text-align:left;">Liste vide.</p>';
        } else {
            [...aliments].reverse().slice(0, 5).forEach(alim => {
                html += `<div class="card" style="margin-bottom:10px; padding:15px; text-align:left; display:flex; justify-content:space-between; align-items:center; border-radius:15px;">
                    <span style="font-weight:500;">${alim.nom}</span>
                    <span style="font-size:0.7rem; color:#cbd5e0;">${new Date(alim.dateAjout).toLocaleDateString()}</span>
                </div>`;
            });
        }
        const old = document.getElementById('ma-liste-aliments');
        if (old) old.remove();
        const listDiv = document.createElement('div');
        listDiv.id = 'ma-liste-aliments';
        listDiv.innerHTML = html;
        dashView.appendChild(listDiv);
    };
}

// ==========================================
// 5. GRAPHIQUE
// ==========================================
const chartOptions = {
    series: [65, 40, 20],
    chart: { height: 350, type: 'radialBar' },
    colors: ['#38b2ac', '#ed8936', '#4299e1'],
    labels: ['Protéines', 'Sel', 'Sucres'],
    plotOptions: { radialBar: { hollow: { size: '45%' }, track: { margin: 10 } } }
};
new ApexCharts(document.querySelector("#pantry-chart"), chartOptions).render();
