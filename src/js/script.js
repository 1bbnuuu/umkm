let map;
let markers = [];

const umkmIcons = {
    'makanan': { icon: 'fa-utensils', color: '#dc2626' },
    'minuman': { icon: 'fa-coffee', color: '#7c3aed' },
    'kerajinan': { icon: 'fa-shopping-bag', color: '#059669' },
    'tekstil': { icon: 'fa-tshirt', color: '#0891b2' },
    'furniture': { icon: 'fa-chair', color: '#ea580c' },
    'elektronik': { icon: 'fa-mobile-alt', color: '#4338ca' },
    'otomotif': { icon: 'fa-car', color: '#374151' },
    'jasa': { icon: 'fa-hands-helping', color: '#9333ea' },
    'pertanian': { icon: 'fa-seedling', color: '#16a34a' },
    'perikanan': { icon: 'fa-fish', color: '#0284c7' },
    'kosmetik': { icon: 'fa-palette', color: '#ec4899' },
    'farmasi': { icon: 'fa-pills', color: '#dc2626' },
    'default': { icon: 'fa-store', color: '#6b7280' }
};

const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2VYB_TLIqZQU9l2WIyZsf0uVMhpPurSD-5Zj0QmSIm_z5mIeQtF56r5zWXV_JIRYGRfVoFq397HBO/pub?output=csv';

function initMap() {
    map = L.map('map').setView([-1.6815, 113.3824], 8);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
    
    loadUMKMData();
}

function createCustomIcon(type) {
    const iconConfig = umkmIcons[type?.toLowerCase()] || umkmIcons.default;
    
    const iconHtml = `
        <div style="
            background-color: ${iconConfig.color};
            width: 35px;
            height: 35px;
            border-radius: 50% 50% 50% 0;
            border: 3px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            transform: rotate(-45deg);
            position: relative;
        ">
            <i class="fas ${iconConfig.icon}" style="
                color: white;
                font-size: 14px;
                transform: rotate(45deg);
            "></i>
        </div>
    `;
    
    return L.divIcon({
        html: iconHtml,
        className: 'custom-marker',
        iconSize: [35, 35],
        iconAnchor: [17, 34],
        popupAnchor: [0, -34]
    });
}

function loadUMKMData() {
    updateStatus('Loading...', 'text-yellow-600');
    
    Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            console.log('Data loaded:', results.data);
            
            if (results.data && results.data.length > 0) {
                clearMarkers();
                
                let validLocations = 0;
                const jenisCounter = new Set();
                
                results.data.forEach(function(row, index) {
                    const name = row['Name'] || row['name'] || row['Nama'] || `UMKM ${index + 1}`;
                    const address = row['Address'] || row['address'] || row['Alamat'] || 'Alamat tidak tersedia';
                    const type = row['Type'] || row['type'] || row['Jenis'] || row['jenis'] || 'default';
                    const images = row['Images'] || row['images'] || row['Gambar'] || row['gambar'] || '';
                    const googleMapsLink = row['GoogleMaps'] || row['googlemaps'] || row['Google Maps'] || row['google_maps'] || '';
                    const lat = parseFloat(row['Latitude'] || row['latitude'] || row['Lat']);
                    const lng = parseFloat(row['Longitude'] || row['longitude'] || row['Lng']);
                    
                    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                        addMarker(lat, lng, name, address, type, images, googleMapsLink);
                        validLocations++;
                        jenisCounter.add(type.toLowerCase());
                    }
                });
                
                document.getElementById('totalUMKM').textContent = results.data.length;
                document.getElementById('totalLokasi').textContent = validLocations;
                document.getElementById('totalJenis').textContent = jenisCounter.size;
                updateStatus(`${validLocations} lokasi dimuat`, 'text-green-600');
                
                updateLegend(jenisCounter);
                
                document.getElementById('loading').style.display = 'none';
                
            } else {
                updateStatus('Data kosong', 'text-red-600');
                document.getElementById('loading').style.display = 'none';
            }
        },
        error: function(error) {
            console.error('Error loading data:', error);
            updateStatus('Error loading', 'text-red-600');
            document.getElementById('loading').style.display = 'none';
        }
    });
}

function addMarker(lat, lng, name, address, type, images, googleMapsLink) {
    let imageGallery = '';
    if (images && images.trim()) {
        const imageLinks = images.split(',').map(link => link.trim()).filter(link => link);
        if (imageLinks.length > 0) {
            imageGallery = `
                <div class="mt-3 border-t pt-3">
                    <p class="text-xs font-medium text-gray-700 mb-2">Foto</p>
                    <div class="grid grid-cols-2 gap-2">
                        ${imageLinks.slice(0, 4).map((link, index) => `
                            <div class="relative group cursor-pointer" onclick="openImageModal('${link}', '${name}')">
                                <img src="${link}" 
                                        alt="Foto ${name}" 
                                        class="w-full h-16 object-cover rounded border group-hover:opacity-75 transition-opacity"
                                        onerror="this.parentElement.style.display='none'"
                                        loading="lazy">
                                <div class="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 rounded transition-all flex items-center justify-center">
                                    <i class="fas fa-search-plus text-white opacity-0 group-hover:opacity-100 transition-opacity"></i>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    ${imageLinks.length > 4 ? `<p class="text-xs text-gray-500 mt-1">+${imageLinks.length - 4} foto lainnya</p>` : ''}
                </div>
            `;
        }
    }

    let googleMapsSection = '';
    if (googleMapsLink && googleMapsLink.trim()) {
        googleMapsSection = `
            <div class="mt-3 border-t pt-3">
                <button onclick="openGoogleMaps('${googleMapsLink}')" 
                        class="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 px-3 rounded flex items-center justify-center space-x-2 transition-colors">
                    <i class="fab fa-google"></i>
                    <span>Buka di Google Maps</span>
                    <i class="fas fa-external-link-alt"></i>
                </button>
            </div>
        `;
    } else {
        const fallbackGoogleMapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        googleMapsSection = `
            <div class="mt-3 border-t pt-3">
                <button onclick="openGoogleMaps('${fallbackGoogleMapsUrl}')" 
                        class="w-full bg-gray-600 hover:bg-gray-700 text-white text-xs py-2 px-3 rounded flex items-center justify-center space-x-2 transition-colors">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>Lihat Lokasi di Maps</span>
                    <i class="fas fa-external-link-alt"></i>
                </button>
            </div>
        `;
    }
    
    const iconConfig = umkmIcons[type?.toLowerCase()] || umkmIcons.default;
    
    const marker = L.marker([lat, lng], {
        icon: createCustomIcon(type)
    }).bindPopup(`
        <div class="p-3 max-w-sm">
            <div class="flex items-center mb-2">
                <div class="bg-gray-100 p-1 rounded mr-2">
                    <i class="fas ${iconConfig.icon} text-gray-600" style="color: ${iconConfig.color}"></i>
                </div>
                <div>
                    <h3 class="font-bold text-gray-800 text-sm">${name}</h3>
                    <span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded capitalize">${type}</span>
                </div>
            </div>
            <p class="text-sm text-gray-600 mb-2">${address}</p>
            ${imageGallery}
            ${googleMapsSection}
            <div class="text-xs text-gray-500 mt-3 pt-2 border-t">
                <i class="fas fa-map-pin mr-1"></i>
                ${lat.toFixed(6)}, ${lng.toFixed(6)}
            </div>
        </div>
    `, { maxWidth: 320, className: 'custom-popup' })
    .addTo(map);
    
    markers.push(marker);
}

function updateLegend(jenisSet) {
    const legendContainer = document.getElementById('legend');
    legendContainer.innerHTML = '';
    
    Array.from(jenisSet).sort().forEach(jenis => {
        const iconConfig = umkmIcons[jenis.toLowerCase()] || umkmIcons.default;
        const legendItem = document.createElement('div');
        legendItem.className = 'flex items-center space-x-2 p-2 bg-gray-50 rounded';
        legendItem.innerHTML = `
            <i class="fas ${iconConfig.icon}" style="color: ${iconConfig.color}"></i>
            <span class="text-gray-700 capitalize">${jenis}</span>
        `;
        legendContainer.appendChild(legendItem);
    });
}

function openGoogleMaps(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
}

function openImageModal(imageUrl, caption) {
    const modal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    const modalCaption = document.getElementById('modalCaption');
    
    modalImage.src = imageUrl;
    modalCaption.textContent = caption;
    
    modal.classList.remove('hidden');
    
    document.body.style.overflow = 'hidden';
    
    modal.focus();
}

function closeImageModal() {
    const modal = document.getElementById('imageModal');
    modal.classList.add('hidden');
    
    document.body.style.overflow = 'auto';
}

function clearMarkers() {
    markers.forEach(marker => {
        map.removeLayer(marker);
    });
    markers = [];
}

function updateStatus(message, className) {
    const statusElement = document.getElementById('dataStatus');
    statusElement.innerHTML = `<i class="fas fa-circle mr-1"></i>${message}`;
    statusElement.className = `text-sm ${className}`;
}

function refreshData() {
    document.getElementById('loading').style.display = 'flex';
    loadUMKMData();
}

document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('imageModal');
    
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeImageModal();
        }
    });
    
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
            closeImageModal();
        }
    });
});

window.addEventListener('load', function() {
    setTimeout(initMap, 500);
});