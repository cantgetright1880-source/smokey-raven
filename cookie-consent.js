/**
 * Cookie Consent Banner
 * GDPR compliant
 */

function initCookieConsent() {
    // Check if already consented
    if (localStorage.getItem('cookie_consent')) {
        return;
    }
    
    // Create banner
    const banner = document.createElement('div');
    banner.id = 'cookie-consent';
    banner.innerHTML = `
        <div class="cookie-content">
            <p>We use cookies to improve your experience. By using BotForge, you agree to our use of cookies.</p>
            <div class="cookie-buttons">
                <button onclick="acceptCookies()">Accept</button>
                <button onclick="declineCookies()" class="secondary">Decline</button>
            </div>
        </div>
    `;
    
    // Add styles
    const styles = `
        #cookie-consent {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: #151528;
            border-top: 1px solid #334155;
            padding: 1rem;
            z-index: 999999;
            display: none;
        }
        .cookie-content {
            max-width: 1200px;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
        }
        .cookie-content p { color: #e2e8f0; margin: 0; }
        .cookie-buttons { display: flex; gap: 0.5rem; }
        .cookie-buttons button {
            padding: 0.5rem 1rem;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-weight: 600;
            background: #8b5cf6;
            color: white;
        }
        .cookie-buttons button.secondary {
            background: transparent;
            color: #94a3b8;
            border: 1px solid #334155;
        }
    `;
    
    const style = document.createElement('style');
    style.textContent = styles;
    document.head.appendChild(style);
    document.body.appendChild(banner);
    
    // Show banner
    setTimeout(() => {
        banner.style.display = 'block';
    }, 1000);
}

function acceptCookies() {
    localStorage.setItem('cookie_consent', 'accepted');
    document.getElementById('cookie-consent').style.display = 'none';
}

function declineCookies() {
    localStorage.setItem('cookie_consent', 'declined');
    document.getElementById('cookie-consent').style.display = 'none';
}

// Initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieConsent);
} else {
    initCookieConsent();
}
