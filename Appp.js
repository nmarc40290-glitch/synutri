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
// 2. INTERFACE, NAVIGATION & VERSION
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
    document.getElementById('dash-view').style.display = (viewName === 'dash') ? 'block' : 'none';
    document.getElementById('search-section').style.display = (viewName === 'search') ? 'block' : 'none';
    
    document.getElementById('nav-dash').classList.toggle('active', viewName === 'dash');
    document.getElementById('nav-search').classList.toggle('active', viewName === 'search');

    if (viewName === 'dash') chargerAlimentsFavoris();
    
    const sb = document.getElementById('sidebar');
    if (sb.style.left === "0px") toggleSidebar();
}

async function forceUpdate() {
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
            await registration.unregister();
        }
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));

        alert("Mise à jour 1.4.1 effectuée. Redémarrage...");
        window.location.href = window.location.origin + window.location.pathname + '?refresh=' + Date.now();
    }
}

// ==========================================
// 3. OUTILS VISUELS (NUTRI-SCORE)
// ==========================================

function getNutriColor(grade) {
    const colors = { 
        'a': '#038141', 
        'b': '#85BB2F', 
        'c': '#FECB02', 
        'd': '#EE8100', 
        'e': '#E63E11' 
    };
    return colors[grade?.toLowerCase()] || '#cbd5e0';
}

// ==========================================
// 4. RECHERCHE API (OPEN FOOD FACTS)
// ==========================================

async function rechercherAliment() {
    const resultsDiv = document.getElementById('search-results');
    const query = document.getElementById('search-input').value.trim();
    
    if (query.length < 3) {
        alert("Tape au moins 3 lettres !");
        return;
    }

    resultsDiv.innerHTML = "<p style='text-align:center;'>🔍 Recherche de '" + query + "'...</p>";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        // URL élargie pour mieux capter les produits bruts et de marque
        const url = `https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20`;

        const response = await fetch(url, {
            method: 'GET',
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });

        clearTimeout(timeoutId);
        const data = await response.json();
        resultsDiv.innerHTML = ""; 

        if (!data.products || data.products.length === 0) {
            resultsDiv.innerHTML = "<p style='text-align:center; padding:20px;'>Aucun résultat. Essayez d'être plus précis (ex: 'Filet de poulet').</p>";
            return;
        }

        data.products.forEach(p => {
            const name = p.product_name_fr || p.product_name;
            if (!name) return; // Ignore les fiches sans nom

            const img = p.image_front_small_url || "https://via.placeholder.com/50";
            const score = p.nutriscore_grade || 'unknown';
            
            const nutriments = {
                calories: Math.round(p.nutriments['energy-kcal_100g'] || 0),
                proteines: p.nutriments.proteins_100g || 0,
                sucres: p.nutriments.sugars_100g || 0,
                sel: p.nutriments.salt_100g || 0,
                score: score
            };

            const card = document.createElement('div');
            card.className = 'card';
            card.style = "display:flex; align-items:center; gap:12px; margin-bottom:12px; text-align:left; padding:12px; border-radius:18px; background:white; border:1px solid #edf2f7; box-shadow: 0 4px 6px rgba(0,0,0,0.02);";

            card.innerHTML = `
                <img src="${img}" style="width:55px; height:55px; border-radius:10px; object-fit:cover;" onerror="this.src='https://via.placeholder.com/50'">
                <div style="flex:1;">
                    <strong style="font-size:0.85rem; display:block; margin-bottom:2px;">${name}</strong>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span style="background:${getNutriColor(score)}; color:white; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:0.7rem; text-transform:uppercase;">${score}</span>
                        <span style="font-size:0.75rem; color:#718096;">${nutriments.calories} kcal</span>
                    </div>
                </div>
                <button type="button" onclick="ajouterAlimentLocal('${p.code}', '${name.replace(/'/g, "\\'")}', ${JSON.stringify(nutriments)})" 
                        style="background:var(--prim); color:white; border:none; width:35px; height:35px; border-radius:10px; font-weight:bold; font-size:1.2rem; cursor:pointer;">
                    +
                </button>
            `;
            resultsDiv.appendChild(card);
        });
    } catch (error) {
        resultsDiv.innerHTML = `<p style="color:red; text-align:center;">❌ ${error.name === 'AbortError' ? 'Connexion trop lente' : 'Erreur de connexion'}</p>`;
    }
}

// ==========================================
// 5. STOCKAGE ET AFFICHAGE FAVORIS
// ==========================================

function ajouterAlimentLocal(id, name, nutriments) {
    if (!db) return;
    const transaction = db.transaction(["aliments"], "readwrite");
    const store = transaction.objectStore("aliments");

    const item = { 
        id: id, 
        nom: name, 
        dateAjout: new Date().toISOString(),
        ...nutriments 
    };

    const requestAdd = store.add(item);
    requestAdd.onsuccess = () => {
        alert(`✅ ${name} ajouté !`);
        showView('dash');
    };
    requestAdd.onerror = () => alert("Cet aliment est déjà dans tes favoris.");
}

function chargerAlimentsFavoris() {
    if (!db) return;
    const store = db.transaction(["aliments"], "readonly").objectStore("aliments");
    const requestGet = store.getAll();

    requestGet.onsuccess = () => {
        const aliments = requestGet.result;
        const dashView = document.getElementById('dash-view');
        
        let htmlListe = '<h3 style="margin-top:25px; text-align:left; font-size:1rem;">Derniers ajouts</h3>';
        
        if (aliments.length === 0) {
            htmlListe += '<p style="color:#a0aec0; font-size:0.8rem; text-align:left;">Ta liste est vide.</p>';
        } else {
            [...aliments].reverse().slice(0, 5).forEach(alim => {
                htmlListe += `
                    <div class="card" style="margin-bottom:10px; padding:12px; display:flex; justify-content:space-between; align-items:center; border-radius:15px; border:1px solid #f7fafc;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:10px; height:10px; border-radius:50%; background:${getNutriColor(alim.score)}"></div>
                            <span style="font-weight:500; font-size:0.9rem;">${alim.nom}</span>
                        </div>
                        <span style="font-size:0.7rem; color:#cbd5e0;">${new Date(alim.dateAjout).toLocaleDateString()}</span>
                    </div>`;
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
// 6. GRAPHIQUE APEXCHARTS
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
