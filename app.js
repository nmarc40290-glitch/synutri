let objectifsUser = { proteines: 50, sel: 5, sucres: 50 };
let db;
let chart;
window.currentKcal = 0;

// BASE DE DONNÉES
const request = indexedDB.open("SynutriDB", 1);
request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains("aliments")) db.createObjectStore("aliments", { keyPath: "id" });
};
request.onsuccess = (e) => { db = e.target.result; chargerAlimentsFavoris(); };

function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const open = sb.style.left === "0px";
    sb.style.left = open ? "-290px" : "0px";
    document.getElementById('overlay').style.display = open ? "none" : "block";
}

function showView(viewName) {
    document.getElementById('dash-view').style.display = (viewName === 'dash') ? 'block' : 'none';
    document.getElementById('search-section').style.display = (viewName === 'search') ? 'block' : 'none';
    document.getElementById('nav-dash').classList.toggle('active', viewName === 'dash');
    document.getElementById('nav-search').classList.toggle('active', viewName === 'search');
}

function getNutriColor(grade) {
    const colors = { 'a': '#038141', 'b': '#85BB2F', 'c': '#FECB02', 'd': '#EE8100', 'e': '#E63E11' };
    return colors[grade?.toLowerCase()] || '#cbd5e0';
}

async function rechercherAliment() {
    const query = document.getElementById('search-input').value;
    const resDiv = document.getElementById('search-results');
    if (query.length < 3) return;
    resDiv.innerHTML = "Chargement...";
    try {
        const r = await fetch(`https://fr.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=15`);
        const d = await r.json();
        resDiv.innerHTML = "";
        d.products.forEach(p => {
            const name = (p.product_name_fr || p.product_name || "Inconnu").replace(/'/g, " ");
            const kcal = Math.round(p.nutriments['energy-kcal_100g'] || 0);
            const score = p.nutriscore_grade || 'unknown';
            const img = p.image_front_small_url || '';
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
                <div style="display:flex; align-items:center; flex:1;">
                    <img src="${img}" class="product-img">
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight:700;">${name}</span>
                        <div>
                            <span class="nutri-tag" style="background:${getNutriColor(score)}">${score}</span>
                            <span style="font-size:0.8rem; color:#a0aec0;">${kcal} kcal/100g</span>
                        </div>
                    </div>
                </div>
                <button onclick="ajouterAliment('${p.code}','${name}',${kcal},${p.nutriments.proteins_100g || 0},${p.nutriments.sugars_100g || 0},${p.nutriments.salt_100g || 0},'${score}','${img}')" style="background:var(--prim); color:white; border:none; width:40px; height:40px; border-radius:12px; font-weight:bold;">+</button>`;
            resDiv.appendChild(card);
        });
    } catch (e) { resDiv.innerHTML = "Erreur"; }
}

function ajouterAliment(id, nom, kcal, prot, sucre, sel, score, img) {
    const store = db.transaction("aliments", "readwrite").objectStore("aliments");
    store.put({ id, nom, calories: kcal, proteines: prot, sucres: sucre, sel: sel, score: score, image: img });
    showView('dash');
    chargerAlimentsFavoris();
}

function chargerAlimentsFavoris() {
    if (!db) return;
    const store = db.transaction("aliments", "readonly").objectStore("aliments");
    store.getAll().onsuccess = (e) => {
        const alims = e.target.result;
        let html = '';
        alims.reverse().slice(0, 10).forEach(a => {
            html += `
                <div class="item-card" onclick="animerDisque('${a.nom.replace(/'/g, "\\'")}',${a.calories},${a.proteines},${a.sucres},${a.sel},'${a.score}')">
                    <div style="display:flex; align-items:center;">
                        <img src="${a.image}" class="product-img" style="width:45px; height:45px;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-weight:600; font-size:0.9rem;">${a.nom}</span>
                            <span style="font-size:0.75rem; color:#a0aec0;">${a.calories} kcal</span>
                        </div>
                    </div>
                    <button onclick="event.stopPropagation(); supprimerAliment('${a.id}')" style="background:none; border:none; color:#cbd5e0; font-size:1.2rem;">×</button>
                </div>`;
        });
        document.getElementById('ma-liste').innerHTML = html;
    };
}

function supprimerAliment(id) {
    db.transaction("aliments", "readwrite").objectStore("aliments").delete(id).onsuccess = () => chargerAlimentsFavoris();
}

function animerDisque(nom, kcal, prot, sucre, sel, score) {
    window.currentKcal = kcal; // Stockage pour le graphique
    const pProt = Math.min((prot / objectifsUser.proteines) * 100, 100);
    const pSel = Math.min((sel / objectifsUser.sel) * 100, 100);
    const pSucre = Math.min((sucre / objectifsUser.sucres) * 100, 100);
    chart.updateSeries([Math.round(pProt), Math.round(pSel), Math.round(pSucre)]);
}

// INITIALISATION DU GRAPHIQUE
chart = new ApexCharts(document.querySelector("#pantry-chart"), {
    series: [0, 0, 0],
    chart: { height: 350, type: 'radialBar' },
    colors: ['#38b2ac', '#ed8936', '#4299e1'],
    labels: ['Protéines', 'Sel', 'Sucres'],
    plotOptions: { 
        radialBar: { 
            hollow: { size: '55%' },
            dataLabels: {
                total: {
                    show: true,
                    label: 'Calories',
                    formatter: function() { return window.currentKcal + " kcal"; }
                }
            }
        } 
    }
});
chart.render();
