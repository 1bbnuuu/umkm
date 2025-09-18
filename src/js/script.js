let map;
let markers = [];
let polygons = [];
let areasVisible = true;

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

const areaColors = [
    '#FF6B6B'
];

const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2VYB_TLIqZQU9l2WIyZsf0uVMhpPurSD-5Zj0QmSIm_z5mIeQtF56r5zWXV_JIRYGRfVoFq397HBO/pub?output=csv';

function initMap() {
    map = L.map('map').setView([-2.2088, 113.9213], 12);
    
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
    updateStatus('Mengambil data dari Google Sheets...', 'text-yellow-600');
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('errorMessage').style.display = 'none';
    
    // Parsing data dari CSV URL menggunakan Papa Parse
    Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            console.log('Data berhasil dimuat:', results);
            
            if (results.data && results.data.length > 0) {
                processUMKMData(results.data);
            } else {
                showError('Data kosong atau tidak valid');
            }
        },
        error: function(error) {
            console.error('Error parsing CSV:', error);
            showError('Gagal mengambil data: ' + error.message);
        }
    });
}

function processUMKMData(data) {
    clearMarkersAndPolygons();
    
    let validLocations = 0;
    let validAreas = 0;
    const jenisCounter = new Set();
    
    data.forEach(function(row, index) {
        // Coba berbagai kemungkinan nama kolom
        const name = row['Name'] || row['name'] || row['Nama'] || row['nama'] || `UMKM ${index + 1}`;
        const address = row['Address'] || row['address'] || row['Alamat'] || row['alamat'] || 'Alamat tidak tersedia';
        const type = row['Jenis'] || row['type'] || row['jenis'] || row['kategori'] || row['Kategori'] || 'default';
        const images = row['gambar'] || row['images'] || row['Gambar'] || row['foto'] || row['Foto'] || '';
        const googleMapsLink = row['GoogleMaps'] || row['googlemaps'] || row['Google Maps'] || row['maps'] || '';
        const lat = parseFloat(row['latitude'] || row['Latitude'] || row['Lat'] || row['lat']);
        const lng = parseFloat(row['Longitude'] || row['longitude'] || row['Lng'] || row['lng'] || row['Long']);
        const area = row['area'] || row['Area'] || row['polygon'] || row['Polygon'] || '';
        
        console.log(`Processing row ${index + 1}:`, { name, lat, lng, type, area: area ? 'yes' : 'no' });
        
        // Validasi koordinat
        if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
            addMarker(lat, lng, name, address, type, images, googleMapsLink);
            validLocations++;
            jenisCounter.add(type.toLowerCase());
        }
        
        // Proses area polygon jika ada
        if (area && area.trim()) {
            const success = addPolygonArea(area, name, type, validAreas);
            if (success) {
                validAreas++;
            }
        }
    });
    
    // Update statistik
    document.getElementById('totalUMKM').textContent = data.length;
    document.getElementById('totalLokasi').textContent = validLocations;
    document.getElementById('totalJenis').textContent = jenisCounter.size;
    document.getElementById('totalArea').textContent = validAreas;
    document.getElementById('mapStatus').textContent = 'Ready';
    
    updateStatus(`${validLocations} lokasi, ${validAreas} area dimuat`, 'text-green-600');
    updateLegend(jenisCounter);
    
    document.getElementById('loading').style.display = 'none';
    
    if (validLocations > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

function showError(message) {
    updateStatus('Error', 'text-red-600');
    document.getElementById('mapStatus').textContent = 'Error';
    document.getElementById('loading').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'flex';
    
    const errorDiv = document.querySelector('#errorMessage .bg-red-100 p');
    if (errorDiv) {
        errorDiv.textContent = message;
    }
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

function addPolygonArea(areaString, name, type, colorIndex) {
    try {
        console.log('Processing area string:', areaString);
        
        const coordinates = areaString.split('|').map(coord => {
            const cleanCoord = coord.trim().replace(/\s+/g, ' ');
            const parts = cleanCoord.split(',').map(c => c.trim());
            
            if (parts.length < 2) {
                throw new Error(`Invalid coordinate format: "${cleanCoord}" - needs lat,lng`);
            }
            
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            
            console.log(`Parsing coordinate: "${cleanCoord}" -> lat: ${lat}, lng: ${lng}`);
            
            if (isNaN(lat) || isNaN(lng)) {
                throw new Error(`Invalid coordinates: lat=${parts[0]}, lng=${parts[1]}`);
            }
            
            if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
                throw new Error(`Coordinates out of valid range: lat=${lat}, lng=${lng}`);
            }
            
            return [lat, lng];
        }).filter(coord => coord);

        console.log('Final coordinates array:', coordinates);

        if (coordinates.length < 2) {
            console.warn(`Area "${name}" needs at least 2 coordinates for a line/polygon. Got: ${coordinates.length}`);
            return false;
        }

        const color = areaColors[colorIndex % areaColors.length];
        const iconConfig = umkmIcons[type?.toLowerCase()] || umkmIcons.default;

        console.log(`Creating ${coordinates.length === 2 ? 'polyline' : 'polygon'} for ${name} with ${coordinates.length} points and color ${color}`);

        let shape;
        let shapeType;
        
        if (coordinates.length === 2) {
            shape = L.polyline(coordinates, {
                color: color,
                weight: 4,
                opacity: 0.8,
                className: 'area-polygon'
            });
            shapeType = 'Garis';
        } else {
            shape = L.polygon(coordinates, {
                color: color,
                fillColor: color,
                weight: 2,
                opacity: 0.9,
                fillOpacity: 0.9,
                className: 'area-polygon'
            });
            shapeType = 'Polygon';
        }

        shape.bindPopup(`
            <div class="p-3">
                <div class="flex items-center mb-2">
                    <div class="bg-gray-100 p-1 rounded mr-2">
                        <i class="fas ${iconConfig.icon}" style="color: ${iconConfig.color}"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-gray-800 text-sm">Area: ${name}</h3>
                        <span class="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded capitalize">${type}</span>
                    </div>
                </div>
                <p class="text-sm text-gray-600 mb-2">Area distribusi/cakupan layanan</p>
                <div class="text-xs text-gray-500 mt-2 pt-2 border-t">
                    <i class="fas ${coordinates.length === 2 ? 'fa-minus' : 'fa-draw-polygon'} mr-1"></i>
                    ${shapeType} dengan ${coordinates.length} titik koordinat
                </div>
                <div class="text-xs text-gray-400 mt-1 max-h-20 overflow-y-auto">
                    ${coordinates.map((coord, i) => `P${i+1}: ${coord[0].toFixed(4)}, ${coord[1].toFixed(4)}`).join('<br>')}
                </div>
            </div>
        `, { maxWidth: 300, className: 'custom-popup' })
        .addTo(map);

        polygons.push(shape);
        console.log(`${shapeType} successfully added to map with ${coordinates.length} coordinates`);
        return true;

    } catch (error) {
        console.error('Error creating area shape for:', name, 'Error:', error.message);
        console.error('Original area string:', areaString);
        
        // Tampilkan pesan error yang lebih detail untuk debugging
        console.warn(`Area "${name}" skipped due to error: ${error.message}`);
        return false;
    }
}

function toggleAreas() {
    areasVisible = !areasVisible;
    const btn = document.getElementById('toggleAreasBtn');
    
    polygons.forEach(polygon => {
        if (areasVisible) {
            polygon.addTo(map);
        } else {
            map.removeLayer(polygon);
        }
    });
    
    btn.innerHTML = areasVisible ? 
        '<i class="fas fa-eye-slash mr-1"></i>' : 
        '<i class="fas fa-eye mr-1"></i>';
}

function updateLegend(jenisSet) {
    const legendContainer = document.getElementById('legend');
    legendContainer.innerHTML = '';
    
    if (jenisSet.size === 0) {
        legendContainer.innerHTML = '<div class="text-gray-500 italic">Tidak ada data jenis UMKM</div>';
        return;
    }
    
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

function clearMarkersAndPolygons() {
    markers.forEach(marker => {
        map.removeLayer(marker);
    });
    polygons.forEach(polygon => {
        map.removeLayer(polygon);
    });
    markers = [];
    polygons = [];
}

function updateStatus(message, className) {
    const statusElement = document.getElementById('dataStatus');
    statusElement.innerHTML = `<i class="fas fa-circle mr-1"></i>${message}`;
    statusElement.className = `text-sm ${className}`;
}

function refreshData() {
    document.getElementById('loading').style.display = 'flex';
    document.getElementById('errorMessage').style.display = 'none';
    
    document.getElementById('totalUMKM').textContent = '-';
    document.getElementById('totalLokasi').textContent = '-';
    document.getElementById('totalJenis').textContent = '-';
    document.getElementById('totalArea').textContent = '-';
    document.getElementById('mapStatus').textContent = 'Loading...';
    
    document.getElementById('legend').innerHTML = '<div class="text-gray-500 italic">Memuat data...</div>';
    
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