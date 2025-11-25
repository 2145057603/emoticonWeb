// 6x4表情包裁剪工具 - 主要JavaScript逻辑

class ImageCropper {
    constructor() {
        this.images = [];
        this.currentImageIndex = 0;
        this.canvas = document.getElementById('cropCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.cropOverlay = document.getElementById('cropOverlay');
        this.isDragging = false;
        this.isResizing = false;
        this.currentHandle = null;
        this.cropRect = { x: 0, y: 0, width: 0, height: 0 };
        this.aspectRatio = 3/2; // 6x4 = 3:2
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initAnimations();
        this.createParticles();
    }
    
    setupEventListeners() {
        // 文件上传相关
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        
        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadZone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        uploadZone.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        
        // 裁剪相关
        this.canvas.addEventListener('mousedown', this.handleCanvasMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleCanvasMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleCanvasMouseUp.bind(this));
        
        // 裁剪控制手柄
        document.querySelectorAll('.crop-handle').forEach(handle => {
            handle.addEventListener('mousedown', this.handleHandleMouseDown.bind(this));
        });
        
        // 按钮事件
        document.getElementById('resetCropBtn').addEventListener('click', this.resetCrop.bind(this));
        document.getElementById('previewBtn').addEventListener('click', this.previewCrop.bind(this));
        document.getElementById('applyAllBtn').addEventListener('click', this.applyToAll.bind(this));
        document.getElementById('resetAllBtn').addEventListener('click', this.resetAll.bind(this));
        document.getElementById('downloadBtn').addEventListener('click', this.downloadAll.bind(this));
        
        // 设置变更
        document.getElementById('aspectRatio').addEventListener('change', this.updateAspectRatio.bind(this));
    }
    
    initAnimations() {
        // 英雄区域动画
        anime.timeline({
            easing: 'easeOutExpo',
            duration: 1000
        })
        .add({
            targets: '#hero-title',
            opacity: [0, 1],
            translateY: [50, 0],
            delay: 300
        })
        .add({
            targets: '#hero-subtitle',
            opacity: [0, 1],
            translateY: [30, 0],
            delay: 200
        }, '-=800')
        .add({
            targets: '#hero-buttons',
            opacity: [0, 1],
            translateY: [20, 0],
            delay: 100
        }, '-=600');
    }
    
    createParticles() {
        const particlesContainer = document.getElementById('particles');
        for (let i = 0; i < 20; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            particle.style.left = Math.random() * 100 + '%';
            particle.style.top = Math.random() * 100 + '%';
            particle.style.width = (Math.random() * 4 + 2) + 'px';
            particle.style.height = particle.style.width;
            particle.style.animationDelay = Math.random() * 6 + 's';
            particle.style.animationDuration = (Math.random() * 4 + 4) + 's';
            particlesContainer.appendChild(particle);
        }
    }
    
    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }
    
    handleDragLeave(e) {
        e.currentTarget.classList.remove('dragover');
    }
    
    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }
    
    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }
    
    processFiles(files) {
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            this.showNotification('请选择有效的图片文件', 'error');
            return;
        }
        
        imageFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const imageData = {
                        id: Date.now() + Math.random(),
                        file: file,
                        src: e.target.result,
                        img: img,
                        name: file.name,
                        size: file.size,
                        cropRect: null
                    };
                    this.images.push(imageData);
                    this.updateImageList();
                    if (this.images.length === 1) {
                        this.loadImage(0);
                    }
                    this.updateButtons();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
        
        this.showNotification(`成功上传 ${imageFiles.length} 张图片`, 'success');
    }
    
    loadImage(index) {
        if (index < 0 || index >= this.images.length) return;
        
        this.currentImageIndex = index;
        const imageData = this.images[index];
        const img = imageData.img;
        
        // 计算适合的尺寸
        const maxWidth = this.canvas.width;
        const maxHeight = this.canvas.height;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
        
        const displayWidth = img.width * scale;
        const displayHeight = img.height * scale;
        const x = (maxWidth - displayWidth) / 2;
        const y = (maxHeight - displayHeight) / 2;
        
        // 清除画布并绘制图片
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.drawImage(img, x, y, displayWidth, displayHeight);
        
        // 更新图片信息
        document.getElementById('originalSize').textContent = `${img.width} × ${img.height}`;
        document.getElementById('fileSize').textContent = this.formatFileSize(imageData.size);
        
        // 初始化裁剪区域
        this.initCropRect(displayWidth, displayHeight, x, y);
        this.updateCropInfo();
        
        // 启用按钮
        document.getElementById('resetCropBtn').disabled = false;
        document.getElementById('previewBtn').disabled = false;
    }
    
    initCropRect(imageWidth, imageHeight, imageX, imageY) {
        const cropHeight = Math.min(imageWidth / this.aspectRatio, imageHeight);
        const cropWidth = cropHeight * this.aspectRatio;
        
        this.cropRect = {
            x: imageX + (imageWidth - cropWidth) / 2,
            y: imageY + (imageHeight - cropHeight) / 2,
            width: cropWidth,
            height: cropHeight
        };
        
        this.updateCropOverlay();
    }
    
    updateCropOverlay() {
        const rect = this.cropRect;
        this.cropOverlay.style.left = rect.x + 'px';
        this.cropOverlay.style.top = rect.y + 'px';
        this.cropOverlay.style.width = rect.width + 'px';
        this.cropOverlay.style.height = rect.height + 'px';
        this.cropOverlay.classList.remove('hidden');
    }
    
    handleCanvasMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.isPointInRect(x, y, this.cropRect)) {
            this.isDragging = true;
            this.dragStartX = x - this.cropRect.x;
            this.dragStartY = y - this.cropRect.y;
        }
    }
    
    handleCanvasMouseMove(e) {
        if (!this.isDragging && !this.isResizing) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.isDragging) {
            const newX = x - this.dragStartX;
            const newY = y - this.dragStartY;
            
            // 确保不超出画布边界
            const maxX = this.canvas.width - this.cropRect.width;
            const maxY = this.canvas.height - this.cropRect.height;
            
            this.cropRect.x = Math.max(0, Math.min(newX, maxX));
            this.cropRect.y = Math.max(0, Math.min(newY, maxY));
            
            this.updateCropOverlay();
            this.updateCropInfo();
        } else if (this.isResizing && this.currentHandle) {
            this.resizeCrop(x, y);
        }
    }
    
    handleCanvasMouseUp() {
        this.isDragging = false;
        this.isResizing = false;
        this.currentHandle = null;
    }
    
    handleHandleMouseDown(e) {
        e.stopPropagation();
        this.isResizing = true;
        this.currentHandle = e.target.id;
    }
    
    resizeCrop(mouseX, mouseY) {
        let newRect = { ...this.cropRect };
        
        switch (this.currentHandle) {
            case 'handle-nw':
                newRect.width = this.cropRect.x + this.cropRect.width - mouseX;
                newRect.height = newRect.width / this.aspectRatio;
                newRect.x = mouseX;
                newRect.y = this.cropRect.y + this.cropRect.height - newRect.height;
                break;
            case 'handle-ne':
                newRect.width = mouseX - this.cropRect.x;
                newRect.height = newRect.width / this.aspectRatio;
                newRect.y = this.cropRect.y + this.cropRect.height - newRect.height;
                break;
            case 'handle-sw':
                newRect.width = this.cropRect.x + this.cropRect.width - mouseX;
                newRect.height = newRect.width / this.aspectRatio;
                newRect.x = mouseX;
                break;
            case 'handle-se':
                newRect.width = mouseX - this.cropRect.x;
                newRect.height = newRect.width / this.aspectRatio;
                break;
        }
        
        // 确保最小尺寸
        if (newRect.width >= 50 && newRect.height >= 50) {
            this.cropRect = newRect;
            this.updateCropOverlay();
            this.updateCropInfo();
        }
    }
    
    isPointInRect(x, y, rect) {
        return x >= rect.x && x <= rect.x + rect.width &&
               y >= rect.y && y <= rect.y + rect.height;
    }
    
    updateCropInfo() {
        const scale = this.getImageScale();
        const actualWidth = Math.round(this.cropRect.width / scale);
        const actualHeight = Math.round(this.cropRect.height / scale);
        
        document.getElementById('cropSize').textContent = `${actualWidth} × ${actualHeight}`;
    }
    
    getImageScale() {
        const img = this.images[this.currentImageIndex].img;
        return Math.min(this.canvas.width / img.width, this.canvas.height / img.height);
    }
    
    resetCrop() {
        if (this.images.length === 0) return;
        
        const imageData = this.images[this.currentImageIndex];
        const img = imageData.img;
        
        const scale = Math.min(this.canvas.width / img.width, this.canvas.height / img.height);
        const displayWidth = img.width * scale;
        const displayHeight = img.height * scale;
        const x = (this.canvas.width - displayWidth) / 2;
        const y = (this.canvas.height - displayHeight) / 2;
        
        this.initCropRect(displayWidth, displayHeight, x, y);
        this.updateCropInfo();
    }
    
    previewCrop() {
        if (this.images.length === 0) return;
        
        const croppedImage = this.getCroppedImage();
        const modal = document.getElementById('previewModal');
        const previewImage = document.getElementById('previewImage');
        
        previewImage.src = croppedImage;
        modal.classList.remove('hidden');
    }
    
    getCroppedImage() {
        const imageData = this.images[this.currentImageIndex];
        const img = imageData.img;
        
        const scale = Math.min(this.canvas.width / img.width, this.canvas.height / img.height);
        const actualX = Math.round((this.cropRect.x - (this.canvas.width - img.width * scale) / 2) / scale);
        const actualY = Math.round((this.cropRect.y - (this.canvas.height - img.height * scale) / 2) / scale);
        const actualWidth = Math.round(this.cropRect.width / scale);
        const actualHeight = Math.round(this.cropRect.height / scale);
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCanvas.width = actualWidth;
        tempCanvas.height = actualHeight;
        
        tempCtx.drawImage(img, actualX, actualY, actualWidth, actualHeight, 0, 0, actualWidth, actualHeight);
        
        return tempCanvas.toDataURL('image/jpeg', 0.9);
    }
    
    updateImageList() {
        const container = document.getElementById('imageList');
        
        if (this.images.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <div class="text-4xl mb-2">📸</div>
                    <p>暂无图片</p>
                    <p class="text-sm">请先上传图片</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = this.images.map((imageData, index) => `
            <div class="image-item bg-white rounded-lg p-3 cursor-pointer border-2 ${index === this.currentImageIndex ? 'border-blue-500' : 'border-gray-200'}" 
                 onclick="imageCropper.loadImage(${index})">
                <div class="flex items-center space-x-3">
                    <img src="${imageData.src}" alt="${imageData.name}" class="w-12 h-12 object-cover rounded">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900 truncate">${imageData.name}</p>
                        <p class="text-xs text-gray-500">${this.formatFileSize(imageData.size)}</p>
                    </div>
                    <button onclick="event.stopPropagation(); imageCropper.removeImage(${index})" 
                            class="text-red-500 hover:text-red-700 text-sm">
                        删除
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    removeImage(index) {
        this.images.splice(index, 1);
        
        if (this.images.length === 0) {
            this.currentImageIndex = 0;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.cropOverlay.classList.add('hidden');
            document.getElementById('originalSize').textContent = '-';
            document.getElementById('cropSize').textContent = '-';
            document.getElementById('fileSize').textContent = '-';
        } else if (this.currentImageIndex >= this.images.length) {
            this.currentImageIndex = this.images.length - 1;
            this.loadImage(this.currentImageIndex);
        } else {
            this.loadImage(this.currentImageIndex);
        }
        
        this.updateImageList();
        this.updateButtons();
    }
    
    updateButtons() {
        const hasImages = this.images.length > 0;
        document.getElementById('applyAllBtn').disabled = !hasImages;
        document.getElementById('resetAllBtn').disabled = !hasImages;
        document.getElementById('downloadBtn').disabled = !hasImages;
    }
    
    updateAspectRatio() {
        const ratio = document.getElementById('aspectRatio').value;
        switch (ratio) {
            case '1:1':
                this.aspectRatio = 1;
                break;
            case '16:9':
                this.aspectRatio = 16/9;
                break;
            case '4:3':
                this.aspectRatio = 4/3;
                break;
            case '3:2':
            default:
                this.aspectRatio = 3/2;
                break;
        }
        
        if (this.images.length > 0) {
            this.resetCrop();
        }
    }
    
    applyToAll() {
        if (this.images.length <= 1) return;
        
        const currentCrop = { ...this.cropRect };
        const currentImageData = this.images[this.currentImageIndex];
        
        this.images.forEach((imageData, index) => {
            if (index !== this.currentImageIndex) {
                // 计算相对位置比例
                const scale = this.getImageScale();
                const img = imageData.img;
                const imgScale = Math.min(this.canvas.width / img.width, this.canvas.height / img.height);
                
                const relativeX = (currentCrop.x - (this.canvas.width - currentImageData.img.width * scale) / 2) / (currentImageData.img.width * scale);
                const relativeY = (currentCrop.y - (this.canvas.height - currentImageData.img.height * scale) / 2) / (currentImageData.img.height * scale);
                const relativeWidth = currentCrop.width / (currentImageData.img.width * scale);
                const relativeHeight = currentCrop.height / (currentImageData.img.height * scale);
                
                // 应用到其他图片
                const newX = (this.canvas.width - img.width * imgScale) / 2 + relativeX * img.width * imgScale;
                const newY = (this.canvas.height - img.height * imgScale) / 2 + relativeY * img.height * imgScale;
                const newWidth = relativeWidth * img.width * imgScale;
                const newHeight = relativeHeight * img.height * imgScale;
                
                imageData.cropRect = {
                    x: newX,
                    y: newY,
                    width: newWidth,
                    height: newHeight
                };
            } else {
                imageData.cropRect = currentCrop;
            }
        });
        
        this.showNotification('裁剪设置已应用到所有图片', 'success');
    }
    
    resetAll() {
        this.images.forEach((imageData, index) => {
            imageData.cropRect = null;
        });
        
        if (this.images.length > 0) {
            this.loadImage(this.currentImageIndex);
        }
        
        this.showNotification('所有裁剪设置已重置', 'success');
    }
    
    async downloadAll() {
        if (this.images.length === 0) return;
        
        const zip = new JSZip();
        let processed = 0;
        const total = this.images.length;
        
        this.updateProgress(processed, total);
        
        for (let i = 0; i < this.images.length; i++) {
            const imageData = this.images[i];
            
            // 切换到当前图片进行处理
            this.currentImageIndex = i;
            this.loadImage(i);
            
            // 等待一小段时间确保图片加载
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 获取裁剪后的图片
            const croppedDataURL = this.getCroppedImage();
            
            // 转换为blob
            const response = await fetch(croppedDataURL);
            const blob = await response.blob();
            
            // 添加到zip文件
            const fileName = `cropped_${i + 1}_${imageData.name}`;
            zip.file(fileName, blob);
            
            processed++;
            this.updateProgress(processed, total);
        }
        
        // 生成zip文件并下载
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cropped_images_${Date.now()}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('图片打包下载完成', 'success');
        this.updateProgress(0, 0);
    }
    
    updateProgress(processed, total) {
        const percentage = total > 0 ? (processed / total) * 100 : 0;
        document.getElementById('progressBar').style.width = percentage + '%';
        document.getElementById('progressText').textContent = `${processed}/${total}`;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `fixed top-20 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transform translate-x-full transition-transform duration-300`;
        
        switch (type) {
            case 'success':
                notification.classList.add('bg-green-500', 'text-white');
                break;
            case 'error':
                notification.classList.add('bg-red-500', 'text-white');
                break;
            case 'warning':
                notification.classList.add('bg-yellow-500', 'text-white');
                break;
            default:
                notification.classList.add('bg-blue-500', 'text-white');
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // 显示动画
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // 自动隐藏
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// 全局函数
function scrollToUpload() {
    document.getElementById('upload').scrollIntoView({ behavior: 'smooth' });
}

function showDemo() {
    // 创建演示图片
    const demoImages = [
        'https://via.placeholder.com/800x600/4299E1/FFFFFF?text=演示图片1',
        'https://via.placeholder.com/800x600/48BB78/FFFFFF?text=演示图片2',
        'https://via.placeholder.com/800x600/ED8936/FFFFFF?text=演示图片3'
    ];
    
    demoImages.forEach((src, index) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            canvas.toBlob(blob => {
                const file = new File([blob], `demo_${index + 1}.jpg`, { type: 'image/jpeg' });
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageData = {
                        id: Date.now() + Math.random(),
                        file: file,
                        src: e.target.result,
                        img: img,
                        name: file.name,
                        size: file.size,
                        cropRect: null
                    };
                    imageCropper.images.push(imageData);
                    imageCropper.updateImageList();
                    if (imageCropper.images.length === 1) {
                        imageCropper.loadImage(0);
                    }
                    imageCropper.updateButtons();
                };
                reader.readAsDataURL(blob);
            }, 'image/jpeg', 0.9);
        };
        img.src = src;
    });
    
    imageCropper.showNotification('演示图片已加载', 'success');
}

function closePreview() {
    document.getElementById('previewModal').classList.add('hidden');
}

// 初始化应用
let imageCropper;

document.addEventListener('DOMContentLoaded', () => {
    imageCropper = new ImageCropper();
});

// 响应式处理
window.addEventListener('resize', () => {
    if (imageCropper && imageCropper.images.length > 0) {
        imageCropper.loadImage(imageCropper.currentImageIndex);
    }
});