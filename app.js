// ==========================================
// 0. CONTRÔLE DE VERSION INTERNE
// ==========================================
const APP_JS_VERSION = "1.5.2"; 
console.log("App.js chargé : v" + APP_JS_VERSION);

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
// 2. NAVIGATION ET AFFICHAGE VERSION
// ==========================================
if (document.getElementById('app-version')) {
    const vSrv = typeof VERSION !== 'undefined' ? VERSION : "?.?";
    document.getElementById('app-version').innerText = `V:${vSrv} (JS:${APP_JS_VERSION})`;
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
        alert("Nettoyage du cache v" + APP_JS_VERSION + "... L'app va redémarrer."); 
        const regs = await navigator.serviceWorker.getRegistrations();
        for (let r of regs) { await r.unregister(); }
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        window.location.href = window.location.origin + window.location.pathname + '?rev=' + Date.now();
    }
}

// ==========================================
// 3. OUTILS VISUELS (COULEURS NUTRI-SCORE)
// ==========================================
function getNutriColor(grade) {
    const colors = { 
        'a': '#038141', 'b': '#85BB2F', 'c': '#FECB02', 'd': '#EE8100', 'e': '#E63E11' 
    };
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
    resultsDiv.innerHTML = "<p style='text-align:center;'>🔍 Recherche...</p>";
    input.blur(); 
    try {
        const url = `https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20`;
        const response = await fetch(url);
        const data = await response.json();
        resultsDiv.innerHTML = ""; 
        data.products.forEach(p => {
            const rawName = p.product_name_fr || p.product_name || "Inconnu";
            const safeName = rawName.replace(/'/g, " "); 
            const img = p.image_front_small_url || "https://via.placeholder.com/50";
            const score = p.nutriscore_grade || 'unknown';
            const kcal = Math.round(p.nutriments['energy-kcal_100g'] || 0);
            const card = document.createElement('div');
            card.innerHTML = `
                <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; padding:12px; border-radius:18px; background:white; border:1px solid #edf2f7;">
                    <img src="${img}" style="width:55px; height:55px; border-radius:10px; object-fit:cover;">
                    <div style="flex:1;">
                        <strong style="font-size:0.85rem;">${safeName}</strong>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="background:${getNutriColor(score)}; color:white; padding:2px 6px; border-radius:4px; font-weight:bold; font-size:0.7rem;">${score.toUpperCase()}</span>
                            <span style="font-size:0.75rem; color:#718096;">${kcal} kcal</span>
                        </div>
                    </div>
                    <button onclick="ajouterAlimentLocal('${p.code}', '${safeName}', ${kcal}, ${p.nutriments.proteins_100g || 0}, ${p.nutriments.sugars_100g || 0}, ${p.nutriments.salt_100g || 0}, '${score}')" style="background:var(--prim); color:white; border:none; width:35px; height:35px; border-radius:10px;">+</button>
                </div>`;
            resultsDiv.appendChild(card);
        });
    } catch (e) { resultsDiv.innerHTML = "Erreur."; }
}

// ==========================================
// 5. STOCKAGE
// ==========================================
function ajouterAlimentLocal(id, name, kcal, prot, sucre, sel, score) {
    const transaction = db.transaction(["aliments"], "readwrite");
    const store = transaction.objectStore("aliments");
    store.put({ id, nom: name, calories: kcal, proteines: prot, sucres: sucre, sel: sel, score: score, dateAjout: new Date().toISOString() });
    transaction.oncomplete = () => { alert(`✅ Ajouté !`); showView('dash'); };
}

function supprimerAlimentLocal(id) {
    if (!confirm("Supprimer ?")) return;
    db.transaction(["aliments"], "readwrite").objectStore("aliments").delete(id).onsuccess = () => chargerAlimentsFavoris();
}

// ==========================================
// 6. DASHBOARD & ANIMATION (FORCE REDRAW)
// ==========================================
let chart; 

function animerDisque(nom, kcal, prot, sucre, sel, score) {
    const couleurScore = getNutriColor(score);
    
    chart.updateOptions({
        plotOptions: {
            radialBar: {
                dataLabels: {
                    total: {
                        show: true,
                        label: score.toUpperCase(),
                        color: couleurScore, 
                        formatter: () => kcal + ' kcal'
                    }
                }
            }
        },
        series: [
            Math.round(Math.min((prot / 50) * 100, 100)),
            Math.round(Math.min((sel / 5) * 100, 100)),
            Math.round(Math.min((sucre / 50) * 100, 100))
        ]
    }, false, true); 
}

function chargerAlimentsFavoris() {
    if (!db) return;
    const store = db.transaction(["aliments"], "readonly").objectStore("aliments");
    store.getAll().onsuccess = (e) => {
        const alims = e.target.result;
        let html = '<h3 style="margin-top:25px; font-size:1.1rem;">Derniers ajouts</h3>';
        [...alims].reverse().slice(0, 8).forEach(a => {
            html += `
                <div onclick="animerDisque('', ${a.calories}, ${a.proteines}, ${a.sucres}, ${a.sel}, '${a.score}')"
                     style="margin-bottom:10px; padding:12px; display:flex; justify-content:space-between; align-items:center; border-radius:15px; background:white; cursor:pointer; border:1px solid #f7fafc;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <div style="width:12px; height:12px; border-radius:50%; background:${getNutriColor(a.score)}"></div>
                        <span style="font-weight:600; font-size:0.85rem;">${a.nom}</span>
                    </div>
                    <button onclick="event.stopPropagation(); supprimerAlimentLocal('${a.id}')" style="background:none; border:none; font-size:1.2rem;">🗑️</button>
                </div>`;
        });
        document.getElementById('ma-liste').innerHTML = html;
    };
}

// ==========================================
// 7. INITIALISATION DU GRAPHIQUE
// ==========================================
const options = {
    series: [0, 0, 0],
    chart: { 
        height: 380, 
        type: 'radialBar',
        toolbar: { show: false }
    },
    colors: ['#38b2ac', '#ed8936', '#4299e1'], 
    labels: ['Protéines', 'Sel', 'Sucres'],
    legend: {
        show: true,
        position: 'bottom',
        horizontalAlign: 'center',
        fontSize: '12px',
        fontFamily: 'inherit',
        fontWeight: 600,
        offsetY: 10,
        markers: { width: 10, height: 10, radius: 12 },
        itemMargin: {
            horizontal: 10,
            vertical: 5 // Permet de mieux respirer si ça passe sur deux lignes
        },
        formatter: function(seriesName, opts) {
            return seriesName; // Affiche "Protéines", "Sel", etc.
        }
    },
    plotOptions: { 
        radialBar: { 
            hollow: { size: '50%' }, 
            track: { 
                margin: 1, 
                background: '#f2f2f2' 
            },
            dataLabels: {
                show: true,
                name: { 
                    show: true, 
                    fontSize: '80px', 
                    fontWeight: '900', 
                    offsetY: -15 
                },
                value: { 
                    show: true, 
                    fontSize: '24px', 
                    fontWeight: '600', 
                    color: '#718096', 
                    offsetY: 25 
                },
                total: {
                    show: true,
                    label: '-',
                    color: '#cbd5e0',
                    formatter: function(w) {
                        return "0 kcal";
                    }
                }
            }
        } 
    },
    stroke: { 
        lineCap: 'round',
        width: 0 
    }
};

chart = new ApexCharts(document.querySelector("#pantry-chart"), options);
chart.render();
