// 1. BASE DE DONNÉES
let db;
const request = indexedDB.open("SynutriDB", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("aliments")) {
        db.createObjectStore("aliments", { keyPath: "id" });
    }
};
request.onsuccess = (e) => {
    db = e.target.result;
    chargerAlimentsFavoris();
};

// 2. NAVIGATION ET VERSION
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
    document.getElementById('dash-view').style.display = (viewName === 'dash') ? 'block' : 'none';
    document.getElementById('search-section').style.display = (viewName === 'search') ? 'block' : 'none';
    document.getElementById('nav-dash').classList.toggle('active', viewName === 'dash');
    document.getElementById('nav-search').classList.toggle('active', viewName === 'search');
    if(viewName === 'dash') chargerAlimentsFavoris();
    const sb = document.getElementById('sidebar');
    if (sb.style.left === "0px") toggleSidebar();
}

async function forceUpdate() {
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let r of registrations) { await r.unregister(); }
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        alert("Mise à jour prête. Redémarrage...");
        window.location.href = window.location.origin + window.location.pathname + '?refresh=' + Date.now();
    }
}

// 3. RECHERCHE ALIMENTS (CORRIGÉE)
async function rechercherAliment() {
    const resultsDiv = document.getElementById('search-results');
    const query = document.getElementById('search-input').value.trim();
    
    if (query.length < 3) return alert("3 lettres minimum");

    resultsDiv.innerHTML = "<p style='text-align:center;'>🔍 Recherche de '" + query + "'...</p>";

    // Sécurité : Timeout de 8 secondes pour éviter le blocage
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
        const url = `https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15`;
        const response = await fetch(url, { 
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeout);

        const data = await response.json();
        resultsDiv.innerHTML = ""; 

        if (!data.products || data.products.length === 0) {
            resultsDiv.innerHTML = "<p>Aucun produit trouvé.</p>";
            return;
        }

        data.products.forEach(p => {
            const name = p.product_name_fr || p.product_name || "Inconnu";
            const img = p.image_front_small_url || "https://via.placeholder.com/50";
            const card = document.createElement('div');
            card.className = 'card';
            card.style = "display:flex; align-items:center; gap:15px; margin-bottom:10px; text-align:left; padding:12px; border-radius:15px; background:white; border:1px solid #edf2f7;";
            card.innerHTML = `
                <img src="${img}" style="width:50px; height:50px; border-radius:8px; object-fit:cover;" onerror="this.src='https://via.placeholder.com/50'">
                <div style="flex:1;"><strong style="font-size:0.9rem;">${name}</strong><br><span style="font-size:0.75rem; color:#718096;">${p.brands || ""}</span></div>
                <button type="button" onclick="ajouterAlimentLocal('${p.code}', '${name.replace(/'/g, "\\'")}')" style="background:var(--prim); color:white; border:none; padding:10px; border-radius:10px;">+</button>
            `;
            resultsDiv.appendChild(card);
        });
    } catch (e) {
        resultsDiv.innerHTML = `<p style="color:red;">❌ ${e.name === 'AbortError' ? 'Temps dépassé (connexion lente)' : 'Erreur de connexion'}</p>`;
    }
}

// 4. FAVORIS
function ajouterAlimentLocal(id, name) {
    const transaction = db.transaction(["aliments"], "readwrite");
    const store = transaction.objectStore("aliments");
    const req = store.add({ id, nom: name, dateAjout: new Date().toISOString() });
    req.onsuccess = () => { alert("Ajouté !"); showView('dash'); };
    req.onerror = () => alert("Déjà présent");
}

function chargerAlimentsFavoris() {
    if (!db) return;
    const store = db.transaction(["aliments"], "readonly").objectStore("aliments");
    store.getAll().onsuccess = (e) => {
        const alims = e.target.result;
        const dash = document.getElementById('dash-view');
        let html = '<h3 style="margin-top:25px; text-align:left;">Derniers ajouts</h3>';
        if (alims.length === 0) html += '<p>Vide</p>';
        else {
            [...alims].reverse().slice(0, 5).forEach(a => {
                html += `<div class="card" style="margin-bottom:10px; padding:15px; display:flex; justify-content:space-between; border-radius:15px;">
                    <span>${a.nom}</span><span style="font-size:0.7rem; color:#cbd5e0;">${new Date(a.dateAjout).toLocaleDateString()}</span>
                </div>`;
            });
        }
        if (document.getElementById('ma-liste')) document.getElementById('ma-liste').remove();
        const div = document.createElement('div');
        div.id = 'ma-liste'; div.innerHTML = html; dash.appendChild(div);
    };
}

// 5. GRAPH
new ApexCharts(document.querySelector("#pantry-chart"), {
    series: [65, 40, 20], chart: { height: 350, type: 'radialBar' },
    colors: ['#38b2ac', '#ed8936', '#4299e1'], labels: ['Prot.', 'Sel', 'Sucres'],
    plotOptions: { radialBar: { hollow: { size: '45%' }, track: { margin: 10 } } }
}).render();
