
// ==========================================
// 1. BASE DE DONNÉES (IndexedDB)
// ==========================================
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

// ==========================================
// 2. NAVIGATION ET VERSION
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
    
    if(viewName === 'dash') chargerAlimentsFavoris();
    
    const sb = document.getElementById('sidebar');
    if (sb.style.left === "0px") toggleSidebar();
}

async function forceUpdate() {
    if ('serviceWorker' in navigator) {
        const v = typeof VERSION !== 'undefined' ? VERSION : "1.2.12";
        alert("Mise à jour " + v + " prête ! Redémarrage..."); 
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let r of regs) { await r.unregister(); }
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        window.location.href = window.location.origin + window.location.pathname + '?refresh=' + Date.now();
    }
}

// ==========================================
// 3. OUTILS VISUELS
// ==========================================
function getNutriColor(grade) {
    const colors = { 'a': '#038141', 'b': '#85BB2F', 'c': '#FECB02', 'd': '#EE8100', 'e': '#E63E11' };
    return colors[grade?.toLowerCase()] || '#cbd5e0';
}

// ==========================================
// 4. RECHERCHE ALIMENTS
// ==========================================
async function rechercherAliment() {
    const resultsDiv = document.getElementById('search-results');
    const input = document.getElementById('search-input');
    const query = input.value.trim();
    
    if (query.length < 3) return alert("3 lettres minimum");

    resultsDiv.innerHTML = "<p style='text-align:center;'>🔍 Analyse de '" + query + "'...</p>";
    input.blur(); 

    try {
        const url = `https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20`;
        const response = await fetch(url);
        const data = await response.json();
        resultsDiv.innerHTML = ""; 

        if (!data.products || data.products.length === 0) {
            resultsDiv.innerHTML = "<p style='text-align:center; padding:20px;'>Aucun produit trouvé.</p>";
            return;
        }

        data.products.forEach(p => {
            const rawName = p.product_name_fr || p.product_name || "Inconnu";
            const safeName = rawName.replace(/'/g, " "); 
            const img = p.image_front_small_url || "https://via.placeholder.com/50";
            const score = p.nutriscore_grade || 'unknown';
            const kcal = Math.round(p.nutriments['energy-kcal_100g'] || 0);
            const prot = p.nutriments.proteins_100g || 0;
            const sucre = p.nutriments.sugars_100g || 0;
            const sel = p.nutriments.salt_100g || 0;

            const card = document.createElement('div');
            card.className = 'card';
            card.style = "display:flex; align-items:center; gap:12px; margin-bottom:12px; text-align:left; padding:12px; border-radius:18px; background:white; border:1px solid #edf2f7;";
            
            card.innerHTML = `
                <img src="${img}" style="width:55px; height:55px; border-radius:10px; object-fit:cover;" onerror="this.src='https://via.placeholder.com/50'">
                <div style="flex:1;">
                    <strong style="font-size:0.85rem;">${safeName}</strong>
                    <div style="display:flex; align-items:center; gap:8px; margin-top:4px;">
                        <span style="background:${getNutriColor(score)}; color:white; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:0.7rem; text-transform:uppercase;">${score}</span>
                        <span style="font-size:0.75rem; color:#718096;">${kcal} kcal</span>
                    </div>
                </div>
                <button type="button" 
                    onclick="ajouterAlimentLocal('${p.code}', '${safeName}', ${kcal}, ${prot}, ${sucre}, ${sel}, '${score}')" 
                    style="background:var(--prim); color:white; border:none; width:35px; height:35px; border-radius:10px; font-weight:bold;">
                    +
                </button>
            `;
            resultsDiv.appendChild(card);
        });
    } catch (e) {
        resultsDiv.innerHTML = "<p style='color:red; text-align:center;'>❌ Erreur de connexion.</p>";
    }
}

// ==========================================
// 5. STOCKAGE (IndexedDB)
// ==========================================
function ajouterAlimentLocal(id, name, kcal, prot, sucre, sel, score) {
    if (!db) return alert("Base de données non prête.");
    const transaction = db.transaction(["aliments"], "readwrite");
    const store = transaction.objectStore("aliments");

    const item = { id, nom: name, calories: kcal, proteines: prot, sucres: sucre, sel: sel, score: score, dateAjout: new Date().toISOString() };
    
    const req = store.put(item); 
    req.onsuccess = () => { 
        alert(`✅ ${name} enregistré/mis à jour !`); 
        showView('dash'); 
    };
    req.onerror = () => alert("Erreur lors de l'enregistrement.");
}

function supprimerAlimentLocal(id) {
    if (!confirm("Supprimer cet aliment ?")) return;
    const transaction = db.transaction(["aliments"], "readwrite");
    const store = transaction.objectStore("aliments");
    const req = store.delete(id);
    req.onsuccess = () => {
        alert("🗑️ Aliment retiré.");
        chargerAlimentsFavoris();
    };
}

// ==========================================
// 6. DASHBOARD & ANIMATION
// ==========================================
let chart; // Variable globale pour le graphique

function animerDisque(nom, kcal, prot, sucre, sel, score) {
    // Calcul des pourcentages
    const pProt = Math.min((prot / 50) * 100, 100);
    const pSel = Math.min((sel / 5) * 100, 100);
    const pSucre = Math.min((sucre / 50) * 100, 100);

    chart.updateOptions({
        plotOptions: {
            radialBar: {
                dataLabels: {
                    total: {
                        show: true,
                        label: score.toUpperCase(), // Nutri-score en haut
                        formatter: function() { 
                            return kcal + ' kcal'; // Calories en dessous
                        },
                        color: getNutriColor(score)
                    }
                }
            }
        },
        series: [Math.round(pProt), Math.round(pSel), Math.round(pSucre)]
    });
}

function chargerAlimentsFavoris() {
    if (!db) return;
    const store = db.transaction(["aliments"], "readonly").objectStore("aliments");
    store.getAll().onsuccess = (e) => {
        const alims = e.target.result;
        const dash = document.getElementById('dash-view');
        let html = '<h3 style="margin-top:25px; text-align:left; font-size:1rem;">Derniers ajouts</h3>';
        
        if (alims.length === 0) {
            html += '<p style="font-size:0.8rem; color:#a0aec0;">Aucun aliment enregistré.</p>';
        } else {
            [...alims].reverse().slice(0, 8).forEach(a => {
                const safeName = a.nom.replace(/'/g, "\\'");
                html += `
                    <div class="card" 
                         onclick="animerDisque('${safeName}', ${a.calories}, ${a.proteines}, ${a.sucres}, ${a.sel}, '${a.score}')"
                         style="margin-bottom:10px; padding:12px; display:flex; justify-content:space-between; align-items:center; border-radius:15px; border:1px solid #f7fafc; background:white; cursor:pointer;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="width:10px; height:10px; border-radius:50%; background:${getNutriColor(a.score)}"></div>
                            <div style="display:flex; flex-direction:column;">
                                <span style="font-weight:500; font-size:0.9rem;">${a.nom}</span>
                                <span style="font-size:0.65rem; color:#cbd5e0;">${a.calories} kcal</span>
                            </div>
                        </div>
                        <button onclick="event.stopPropagation(); supprimerAlimentLocal('${a.id}')" 
                                style="background:none; border:none; color:#e53e3e; font-size:1.1rem; padding:5px;">🗑️</button>
                    </div>`;
            });
        }
        const old = document.getElementById('ma-liste');
        if (old) old.remove();
        const div = document.createElement('div');
        div.id = 'ma-liste'; div.innerHTML = html; dash.appendChild(div);
    };
}

// ==========================================
// 7. INITIALISATION DU GRAPHIQUE
// ==========================================
const options = {
    series: [0, 0, 0],
    chart: { height: 350, type: 'radialBar' },
    colors: ['#38b2ac', '#ed8936', '#4299e1'], 
    labels: ['Protéines', 'Sel', 'Sucres'],
    plotOptions: { 
        radialBar: { 
            hollow: { size: '55%' }, 
            track: { margin: 10 },
            dataLabels: {
                name: { fontSize: '16px', color: '#718096', offsetY: -10 },
                value: { fontSize: '22px', fontWeight: 'bold', offsetY: 5 },
                total: {
                    show: true,
                    label: 'SCORE',
                    formatter: function() { return "-"; }
                }
            }
        } 
    }
};

chart = new ApexCharts(document.querySelector("#pantry-chart"), options);
chart.render();
            
