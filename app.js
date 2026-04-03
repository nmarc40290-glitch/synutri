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
        // ...
        // Utilise la variable VERSION pour que le message soit toujours juste :
        alert("Mise à jour " + VERSION + " prête ! Redémarrage..."); 
        // ...
    }
}


// 3. FONCTION DE COULEUR NUTRI-SCORE
function getNutriColor(grade) {
    const colors = { 'a': '#038141', 'b': '#85BB2F', 'c': '#FECB02', 'd': '#EE8100', 'e': '#E63E11' };
    return colors[grade?.toLowerCase()] || '#cbd5e0';
}

// 4. RECHERCHE ALIMENTS (AVEC NUTRIMENTS ET NUTRI-SCORE)
async function rechercherAliment() {
    const resultsDiv = document.getElementById('search-results');
    const input = document.getElementById('search-input');
    const query = input.value.trim();
    
    if (query.length < 3) return alert("3 lettres minimum");

    // 1. ON VIDE L'ÉCRAN ET ON AFFICHE LE CHARGEMENT (RIEN D'AUTRE)
    resultsDiv.innerHTML = "<p style='text-align:center;'>🔍 Analyse de '" + query + "'...</p>";
    input.blur(); 

    try {
        const url = `https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20`;
        const response = await fetch(url);
        const data = await response.json();

        // 2. ON NE VIDE L'ÉCRAN POUR METTRE LES RÉSULTATS QU'ICI
        resultsDiv.innerHTML = ""; 

        // 3. ON VÉRIFIE SI C'EST VIDE *APRÈS* AVOIR REÇU LES DONNÉES
        if (!data.products || data.products.length === 0) {
            resultsDiv.innerHTML = "<p style='text-align:center; padding:20px;'>Aucun produit trouvé pour cette recherche.</p>";
            return;
        }

        // 4. SI ON A DES PRODUITS, ON LES AFFICHE
        data.products.forEach(p => {
            const name = p.product_name_fr || p.product_name;
            if (!name) return;

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
            card.style = "display:flex; align-items:center; gap:12px; margin-bottom:12px; text-align:left; padding:12px; border-radius:18px; background:white; border:1px solid #edf2f7;";
            card.innerHTML = `
                <img src="${img}" style="width:55px; height:55px; border-radius:10px; object-fit:cover;">
                <div style="flex:1;">
                    <strong style="font-size:0.85rem;">${name}</strong>
                    <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                        <span style="background:${getNutriColor(score)}; color:white; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:0.7rem; text-transform:uppercase;">${score}</span>
                        <span style="font-size:0.75rem; color:#718096;">${nutriments.calories} kcal</span>
                    </div>
                </div>
                <button type="button" onclick="ajouterAlimentLocal('${p.code}', '${name.replace(/'/g, "\\'")}', ${JSON.stringify(nutriments)})" 
                        style="background:var(--prim); color:white; border:none; width:35px; height:35px; border-radius:10px;">+</button>
            `;
            resultsDiv.appendChild(card);
        });

    } catch (e) {
        resultsDiv.innerHTML = "<p style='color:red; text-align:center;'>❌ Erreur de connexion au serveur.</p>";
    }
                              }

// 5. STOCKAGE COMPLET
function ajouterAlimentLocal(id, name, dataNutri) {
    const transaction = db.transaction(["aliments"], "readwrite");
    const store = transaction.objectStore("aliments");
    const item = { id, nom: name, dateAjout: new Date().toISOString(), ...dataNutri };
    
    const req = store.add(item);
    req.onsuccess = () => { 
        alert(`✅ ${name} enregistré !`); 
        showView('dash'); 
    };
    req.onerror = () => alert("Déjà dans tes favoris.");
}

// 6. DASHBOARD (AFFICHAGE DU NUTRI-SCORE DANS LA LISTE)
function chargerAlimentsFavoris() {
    if (!db) return;
    const store = db.transaction(["aliments"], "readonly").objectStore("aliments");
    store.getAll().onsuccess = (e) => {
        const alims = e.target.result;
        const dash = document.getElementById('dash-view');
        let html = '<h3 style="margin-top:25px; text-align:left; font-size:1rem;">Derniers ajouts</h3>';
        
        if (alims.length === 0) html += '<p style="font-size:0.8rem; color:#a0aec0;">Aucun aliment enregistré.</p>';
        else {
            [...alims].reverse().slice(0, 5).forEach(a => {
                html += `
                    <div class="card" style="margin-bottom:10px; padding:12px; display:flex; justify-content:space-between; align-items:center; border-radius:15px; border:1px solid #f7fafc;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:10px; height:10px; border-radius:50%; background:${getNutriColor(a.score)}"></div>
                            <span style="font-weight:500; font-size:0.9rem;">${a.nom}</span>
                        </div>
                        <span style="font-size:0.7rem; color:#cbd5e0;">${new Date(a.dateAjout).toLocaleDateString()}</span>
                    </div>`;
            });
        }
        if (document.getElementById('ma-liste')) document.getElementById('ma-liste').remove();
        const div = document.createElement('div');
        div.id = 'ma-liste'; div.innerHTML = html; dash.appendChild(div);
    };
}

// 7. GRAPHIQUE (DASHBOARD)
new ApexCharts(document.querySelector("#pantry-chart"), {
    series: [65, 40, 20], chart: { height: 350, type: 'radialBar' },
    colors: ['#38b2ac', '#ed8936', '#4299e1'], labels: ['Prot.', 'Sel', 'Sucres'],
    plotOptions: { radialBar: { hollow: { size: '45%' }, track: { margin: 10 } } }
}).render();
