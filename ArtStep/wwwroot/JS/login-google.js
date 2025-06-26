import { API_BASE_URL } from './config.js';
import './header.js';

window.addEventListener('load', () => {
    const btn = document.getElementById('btnGoogleLogin');

    const clientId = '329360944619-u7h08sn5itdh5qi3ulq95d09ds4ke97h.apps.googleusercontent.com';
    const redirectUri = 'http://localhost:5155/login-callback.html';
    const scope = 'openid email profile';
    const responseType = 'code';
    const prompt = 'select_account';

    if (btn) {
        const oauthUrl =
            `https://accounts.google.com/o/oauth2/v2/auth` +
            `?client_id=${clientId}` +
            `&redirect_uri=${encodeURIComponent(redirectUri)}` +
            `&response_type=${responseType}` +
            `&scope=${encodeURIComponent(scope)}` +
            `&prompt=${prompt}`;

        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = oauthUrl;
        });
    }
});
