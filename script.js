document.addEventListener('DOMContentLoaded', () => {
    // Récupérer les sections de la légende
    const sections = [
        'ldft-options',
        'state-options',
        'region-options',
        'length-options',
        'traffic-options',
        'suspension-options',
        'nature-options',
        'tonnage-options'
    ];

    // Initialiser les sections masquées au chargement
    sections.forEach(sectionId => {
        const section = document.getElementById(sectionId);
        if (section) section.style.display = 'none';
    });

    // Ajouter un gestionnaire d'événement pour chaque checkbox principale
    document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        if (checkbox.id.startsWith('toggle-')) {
            checkbox.addEventListener('change', event => {
                const sectionId = event.target.id.replace('toggle-', '') + '-options';
                toggleSection(sectionId, event.target.checked);
            });
        }
    });

    // Initialiser la carte OpenLayers
    const map = new ol.Map({
        target: 'map',
        layers: [
            new ol.layer.Tile({
                source: new ol.source.TileWMS({
                    url: 'https://dev-dwa.reseau.sncf.fr/geoserver/fonds_de_plan/wms',
                    params: {
                        'SERVICE': 'WMS',
                        'VERSION': '1.3.0',
                        'REQUEST': 'GetMap',
                        'LAYERS': 'fonds_de_plan:fond_plan_ferro',
                        'SRS': 'EPSG:3857',
                        'FORMAT': 'image/png',
                        'TILED': true
                    },
                    crossOrigin: 'anonymous'
                })
            })
        ],
        view: new ol.View({
            center: ol.proj.fromLonLat([2.07653, 48.29581]),
            zoom: 6
        })
    });

    // Ajouter des contrôles à la carte
    map.addControl(new ol.control.Zoom());
    map.addControl(new ol.control.Rotate());

    // Ajouter un popup pour afficher les détails
    const popupElement = document.createElement('div');
    popupElement.id = 'popup';
    popupElement.className = 'ol-popup';
    document.body.appendChild(popupElement);

    const overlay = new ol.Overlay({
        element: popupElement,
        positioning: 'bottom-center',
        stopEvent: false
    });
    map.addOverlay(overlay);

    // Charger les données GeoJSON et ajouter des filtres
    fetch('LDFT_Dernier_3857.geojson')
        .then(response => response.json())
        .then(data => {
            const ldftSource = new ol.source.Vector({
                features: new ol.format.GeoJSON().readFeatures(data, {
                    dataProjection: 'EPSG:3857',
                    featureProjection: 'EPSG:3857'
                })
            });

            const ldftLayer = new ol.layer.Vector({
                source: ldftSource,
                style: new ol.style.Style({
                    stroke: new ol.style.Stroke({
                        color: '#FF0000',
                        width: 2
                    })
                })
            });

            map.addLayer(ldftLayer);

            // Ajouter un filtre dynamique basé sur les options sélectionnées
            document.querySelectorAll('.legend-options input[type="checkbox"]').forEach(filterCheckbox => {
                filterCheckbox.addEventListener('change', () => applyFilters(ldftSource));
            });

            // Appliquer les filtres initialement
            applyFilters(ldftSource);

            // Ajouter un popup à la carte
            map.on('singleclick', evt => {
                const feature = map.forEachFeatureAtPixel(evt.pixel, feature => feature);
                if (feature) {
                    const properties = feature.getProperties();
                    popupElement.innerHTML = `
                        <h3>Détails du segment - LDFT</h3>
                        <p><strong>Nom de la gare de début :</strong> ${properties.Lib_début || 'N/A'}</p>
                        <p><strong>Nom de la gare de fin :</strong> ${properties.Lib_fin || 'N/A'}</p>
                        <p><strong>État global :</strong> ${properties.Etat_globa || 'N/A'}</p>
                        <p><strong>Longueur :</strong> ${properties.longueur || 'N/A'} km</p>
                    `;
                    overlay.setPosition(evt.coordinate);
                } else {
                    overlay.setPosition(undefined);
                }
            });
        })
        .catch(error => console.error('Erreur lors du chargement des données GeoJSON :', error));
});

// Fonction pour afficher/masquer les sections
function toggleSection(sectionId, isChecked) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.style.display = isChecked ? 'block' : 'none';
    }
}

// Fonction pour appliquer les filtres sur les entités GeoJSON
function applyFilters(ldftSource) {
    const selectedStates = getSelectedFilters('state-filter');
    const selectedRegions = getSelectedFilters('region-filter');
    const selectedLengths = getSelectedFilters('length-filter');
    const selectedTraffic = getSelectedFilters('traffic-filter');
    const selectedSuspension = getSelectedFilters('suspension-filter');
    const selectedNature = getSelectedFilters('nature-filter');
    const selectedTonnage = getSelectedFilters('tonnage-filter');

    ldftSource.getFeatures().forEach(feature => {
        const matchesState = matchFilter(selectedStates, feature.get('Etat_globa'));
        const matchesRegion = matchFilter(selectedRegions, feature.get('Region'));
        const matchesLength = matchLength(selectedLengths, feature.get('Length'));
        const matchesTraffic = matchFilter(selectedTraffic, feature.get('Traffic'));
        const matchesSuspension = matchFilter(selectedSuspension, feature.get('Suspension'));
        const matchesNature = matchFilter(selectedNature, feature.get('Nature'));
        const matchesTonnage = matchFilter(selectedTonnage, feature.get('Tonnage'));

        const isVisible = matchesState && matchesRegion && matchesLength && matchesTraffic && matchesSuspension && matchesNature && matchesTonnage;

        feature.setStyle(isVisible ? null : new ol.style.Style({}));
    });
}

// Récupérer les filtres sélectionnés
function getSelectedFilters(className) {
    return Array.from(document.querySelectorAll(`.${className}:checked`)).map(checkbox => checkbox.value);
}

// Fonction pour vérifier les filtres simples
function matchFilter(selectedValues, featureValue) {
    return selectedValues.length === 0 || selectedValues.includes(featureValue);
}

// Fonction pour gérer les longueurs spécifiques
function matchLength(selectedLengths, length) {
    if (!length) return false;
    return selectedLengths.some(range => {
        if (range === '10km') return length <= 10;
        if (range === '10-30km') return length > 10 && length <= 30;
        if (range === '>30km') return length > 30;
        return false;
    });
}
