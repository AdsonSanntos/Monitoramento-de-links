// Dados das unidades e links com coordenadas geográficas (exemplo genérico)
const UNITS = {
    "Manaus": {
        lat: -3.1190,
        lng: -60.0217,
        links: {
     
        }
    },
    "Belém": {
        lat: -1.4558,
        lng: -48.4902,
        links: {
           
        }
    },
    "Fortaleza": {
        lat: -3.7172,
        lng: -38.5433,
        links: {
            
        }
    },
    "Natal": {
        lat: -5.7945,
        lng: -35.2099,
        links: {
           
        }
    },
    "Campo Grande": {
        lat: -20.4697,
        lng: -54.6201,
        links: {
            
        }
    },
    "Cuiabá": {
        lat: -15.5989,
        lng: -56.0949,
        links: {
           
        }
    },
    "Goiânia": {
        lat: -16.6809,
        lng: -49.2533,
        links: {
           
        }
    },
    "Belo Horizonte": {
        lat: -19.9167,
        lng: -43.9345,
        links: {
           
        }
    },
    "Curitiba": {
        lat: -25.4284,
        lng: -49.2733,
        links: {
            
        }
    },
    "Florianópolis": {
        lat: -27.5969,
        lng: -48.5486,
        links: {
           
        }
    },
    "Porto Alegre": {
        lat: -30.0346,
        lng: -51.2177,
        links: {
            
        }
    },
    "Boa Vista": {
        lat: 2.8195,
        lng: -60.6733,
        links: {
            
        }
    }
};
 
// Variáveis globais
let map;
let markers = {};
let selectedUnit = null;
let statusData = {};
let offlineUnits = {};
 
// Inicializa o mapa
function initMap() {
    map = L.map('map').setView([-14.2350, -51.9253], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
 
    // Adiciona marcadores para cada unidade
    Object.entries(UNITS).forEach(([unitName, unitData]) => {
        const marker = L.marker([unitData.lat, unitData.lng]).addTo(map);
        marker.unitName = unitName;
        markers[unitName] = marker;
 
        // Evento de clique para centralizar o mapa na unidade
        marker.on('click', function() {
            selectUnit(this.unitName);
            map.setView([unitData.lat, unitData.lng], 10);
        });
    });
 
    // Atualiza o status das unidades periodicamente
    updateAllUnitsStatus();
    setInterval(updateAllUnitsStatus, 5000); // Atualiza a cada 5 segundos
}
 
// Função para selecionar uma unidade
function selectUnit(unitName) {
    selectedUnit = unitName;
    updateAllUnitsList();
    const unitData = UNITS[unitName];
    map.setView([unitData.lat, unitData.lng], 10);
}
 
// Função para atualizar o status de todas as unidades
function updateAllUnitsStatus() {
    // Simulação de busca de status (substituir por fetch real se necessário)
    const mockStatusData = {};
    Object.keys(UNITS).forEach(unitName => {
        mockStatusData[unitName] = {};
        Object.keys(UNITS[unitName].links).forEach(linkName => {
            // Simula status aleatório para demonstração
            mockStatusData[unitName][linkName] = Math.random() > 0.3;
        });
    });
    statusData = mockStatusData;
 
    updateOfflineLinks();
    updateAllUnitsList();
    updateMarkers();
}
 
// Função para atualizar os marcadores no mapa
function updateMarkers() {
    Object.entries(statusData).forEach(([unitName, unitLinks]) => {
        const isOffline = Object.values(unitLinks).some(status => !status);
        const marker = markers[unitName];
        if (marker) {
            if (isOffline) {
                marker.setIcon(L.divIcon({
                    className: 'blink-marker',
                    html: `<div style="background-color: red; width: 20px; height: 20px; border-radius: 50%;"></div>`
                }));
            } else {
                marker.setIcon(L.divIcon({
                    className: '',
                    html: `<div style="background-color: green; width: 20px; height: 20px; border-radius: 50%;"></div>`
                }));
            }
        }
    });
}
 
// Função para atualizar a lista de links offline
function updateOfflineLinks() {
    const offlineLinksList = document.getElementById('offline-links-list');
    offlineLinksList.innerHTML = '';
 
    // Simula dados offline para demonstração
    offlineUnits = {};
    Object.entries(statusData).forEach(([unitName, links]) => {
        offlineUnits[unitName] = {};
        Object.entries(links).forEach(([linkName, isOnline]) => {
            if (!isOnline) {
                offlineUnits[unitName][linkName] = {
                    ip: UNITS[unitName].links[linkName],
                    desde: new Date().toLocaleTimeString()
                };
            }
        });
    });
 
    // Exibe todas as unidades offline
    Object.entries(offlineUnits).forEach(([cidade, provedores]) => {
        Object.entries(provedores).forEach(([nome, dados]) => {
            const offlineLinkItem = document.createElement('div');
            offlineLinkItem.className = 'offline-link-item';
            offlineLinkItem.textContent = `${cidade} - ${nome}: ${dados.ip} (desde ${dados.desde})`;
            offlineLinksList.appendChild(offlineLinkItem);
        });
    });
 
    // Se não houver unidades offline
    if (Object.keys(offlineUnits).length === 0) {
        offlineLinksList.innerHTML = '<div class="offline-link-item">Nenhum link offline no momento.</div>';
    }
}
 
// Função para atualizar a lista de todas as unidades
function updateAllUnitsList() {
    const allUnitsList = document.getElementById('all-units-list');
    allUnitsList.innerHTML = '';
 
    // Se houver uma unidade selecionada, exibe ela primeiro
    if (selectedUnit) {
        const selectedUnitElement = createUnitElement(selectedUnit, true);
        allUnitsList.appendChild(selectedUnitElement);
    }
 
    // Exibe as outras unidades
    Object.entries(UNITS).forEach(([unitName, unitData]) => {
        if (unitName !== selectedUnit) {
            const unitElement = createUnitElement(unitName, false);
            allUnitsList.appendChild(unitElement);
        }
    });
}
 
// Função para criar um elemento de unidade
function createUnitElement(unitName, isSelected) {
    const unitElement = document.createElement('div');
    unitElement.className = `unit-item ${isSelected ? 'selected-unit' : ''}`;
 
    const unitHeader = document.createElement('div');
    unitHeader.className = 'unit-header';
    unitHeader.innerHTML = `
<span>${unitName}</span>
<span class="toggle-links" onclick="event.stopPropagation(); toggleLinks('${unitName}')">+</span>
    `;
    unitElement.appendChild(unitHeader);
 
    const unitLinks = document.createElement('div');
    unitLinks.className = 'unit-links';
    unitLinks.id = `links-${unitName}`;
 
    // Adiciona os links
    Object.entries(UNITS[unitName].links).forEach(([linkName, ip]) => {
        const status = statusData[unitName] ? statusData[unitName][linkName] : false;
        const linkItem = document.createElement('div');
        linkItem.className = `link-item ${status ? 'online' : 'offline'}`;
        linkItem.textContent = `${linkName}: ${ip} (${status ? 'Online' : 'Offline'})`;
        unitLinks.appendChild(linkItem);
    });
 
    unitElement.appendChild(unitLinks);
 
    // Evento de clique para selecionar a unidade
    unitElement.addEventListener('click', () => {
        selectUnit(unitName);
    });
 
    return unitElement;
}
 
// Função para alternar a exibição dos links
function toggleLinks(unitName) {
    const linksElement = document.getElementById(`links-${unitName}`);
    const toggleButton = event.target;
    if (linksElement.classList.contains('show')) {
        linksElement.classList.remove('show');
        toggleButton.textContent = '+';
    } else {
        linksElement.classList.add('show');
        toggleButton.textContent = '-';
    }
}
 
// CSS para piscar o marcador
const style = document.createElement('style');
style.innerHTML = `
    .blink-marker {
        animation: blink 0.5s infinite;
    }
    @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
    }
`;
document.head.appendChild(style);
 
// Inicializa o mapa quando a página carregar
window.onload = initMap;
