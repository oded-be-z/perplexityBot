// Fix event handlers after page loads
document.addEventListener('DOMContentLoaded', function() {
    // Fix quick action buttons
    const quickButtons = document.querySelectorAll('.quick-action-btn');
    quickButtons[0]?.addEventListener('click', () => sendQuickMessage('Analyze Apple stock with technical indicators'));
    quickButtons[1]?.addEventListener('click', () => sendQuickMessage('Show me Bitcoin price trends with charts'));
    quickButtons[2]?.addEventListener('click', () => sendQuickMessage('Compare Gold vs Silver performance'));
    quickButtons[3]?.addEventListener('click', () => sendQuickMessage('What are the best dividend stocks right now?'));
    quickButtons[4]?.addEventListener('click', () => promptFileUpload());
    
    // Fix send button
    const sendBtn = document.getElementById('send-btn');
    if (sendBtn) {
        sendBtn.addEventListener('click', () => sendMessage());
    }
    
    // Fix file upload button
    const fileUploadBtn = document.getElementById('file-upload-btn');
    if (fileUploadBtn) {
        fileUploadBtn.addEventListener('click', () => document.getElementById('file-input').click());
    }
    
    // Fix mobile menu toggle
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    if (menuToggle) {
        menuToggle.addEventListener('click', () => toggleSidebar());
    }
});
