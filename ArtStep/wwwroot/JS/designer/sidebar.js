document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    document.getElementById('logout-btn').addEventListener("click", function (e) {
        e.preventDefault();
        // Xử lý khi người dùng click vào nút Sign Out
        console.log("Sign Out button clicked");
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('username');
        localStorage.removeItem('userId');
        window.location.href = "/Login.html";
    });
    // Check if sidebar state is stored in localStorage
    const sidebarState = localStorage.getItem('sidebarState');
    if (sidebarState === 'collapsed') {
        sidebar.classList.add('collapsed');
    }
    
    // Toggle sidebar on button click
    sidebarToggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
        
        // Store sidebar state in localStorage
        if (sidebar.classList.contains('collapsed')) {
            localStorage.setItem('sidebarState', 'collapsed');
        } else {
            localStorage.setItem('sidebarState', 'expanded');
        }
    });
    
    // Handle mobile sidebar
    function handleMobileSidebar() {
        if (window.innerWidth <= 768) {
            sidebar.classList.add('mobile');
            
            // Add mobile menu button if it doesn't exist
            if (!document.getElementById('mobile-menu-btn')) {
                const mobileMenuBtn = document.createElement('button');
                mobileMenuBtn.id = 'mobile-menu-btn';
                mobileMenuBtn.className = 'mobile-menu-btn';
                mobileMenuBtn.innerHTML = '<i class="fas fa-bars"></i>';
                document.querySelector('.main-content').prepend(mobileMenuBtn);
                
                mobileMenuBtn.addEventListener('click', function() {
                    sidebar.classList.toggle('open');
                });
            }
        } else {
            sidebar.classList.remove('mobile', 'open');
            
            // Remove mobile menu button if it exists
            const mobileMenuBtn = document.getElementById('mobile-menu-btn');
            if (mobileMenuBtn) {
                mobileMenuBtn.remove();
            }
        }
    }
   
    // Initial check and add resize listener
    handleMobileSidebar();
    window.addEventListener('resize', handleMobileSidebar);
});