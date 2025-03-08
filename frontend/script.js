document.querySelectorAll(".scrollbar-hide").forEach(el => {
    el.style.overflowX = "auto";
    el.style.scrollbarWidth = "none";
});

const menuBtn = document.getElementById('menu-btn');
        const mobileMenu = document.getElementById('mobile-menu');
        const closeBtn = document.getElementById('close-btn');

        function toggleMenu() {
            mobileMenu.classList.toggle('-translate-x-full');
        }

        menuBtn.addEventListener('click', toggleMenu);
        closeBtn.addEventListener('click', toggleMenu);

//Three.js code
document.addEventListener("DOMContentLoaded", function () {
    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    const renderer = new THREE.WebGLRenderer({ 
        canvas: document.getElementById("threejs-canvas"), 
        alpha: true 
    });
    
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Particle system
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 500;
    const positions = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 10;
    }

    particlesGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const particlesMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.05 });
    const particles = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particles);
 
    camera.position.z = 5;

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        particles.rotation.y += 0.001;
        renderer.render(scene, camera);
    }
    animate();

    // Handle resizing
    window.addEventListener("resize", () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });
});

//Scroll carousel
function autoScrollCarousel(carouselId, intervalTime) {
    const carousel = document.getElementById(carouselId);
    const cards = carousel.children;
    let index = 0;
    let interval;

    function scrollToNext() {
        if (index >= cards.length) {
            index = 0; // Reset to the first card after reaching the end
        }
        const cardWidth = cards[index].offsetWidth + 24; // Card width + spacing
        carousel.scrollTo({
            left: index * cardWidth,
            behavior: "smooth"
        });
        index++;
    }

    function startAutoScroll() {
        interval = setInterval(scrollToNext, intervalTime);
    }

    function stopAutoScroll() {
        clearInterval(interval);
    }

    // Start scrolling initially
    startAutoScroll();

    // Stop scrolling when hovered
    carousel.addEventListener("mouseenter", stopAutoScroll);
    // Resume scrolling when hover is removed
    carousel.addEventListener("mouseleave", startAutoScroll);
}

// Apply to both carousels
autoScrollCarousel("school-carousel", 1500); // Scroll every 1.5s
autoScrollCarousel("college-carousel", 1500);

