import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    deleteDoc, 
    doc, 
    updateDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCEdOK3pK6hUHFQAtqImlCsojeTRlRG-Io",
    authDomain: "cando-memo.firebaseapp.com",
    projectId: "cando-memo",
    storageBucket: "cando-memo.firebasestorage.app",
    messagingSenderId: "483833881262",
    appId: "1:483833881262:web:39333a4c6979997573833f",
    measurementId: "G-6PHZQKFX1B"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const authContainer = document.getElementById('auth-container');
const userProfile = document.getElementById('user-profile');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const mainContent = document.getElementById('main-content');
const welcomeScreen = document.getElementById('welcome-screen');
const memoInput = document.getElementById('memo-input');
const saveBtn = document.getElementById('save-btn');
const memoList = document.getElementById('memo-list');
const emptyState = document.getElementById('empty-state');
const loading = document.getElementById('loading');

let currentUser = null;
let unsubscribeMemos = null;

// Auth Logic
loginBtn.onclick = () => signInWithPopup(auth, provider).catch(console.error);
logoutBtn.onclick = () => signOut(auth).catch(console.error);

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        showApp();
        loadMemos();
    } else {
        currentUser = null;
        showWelcome();
        if (unsubscribeMemos) unsubscribeMemos();
    }
});

function showApp() {
    loginBtn.classList.add('hidden');
    userProfile.classList.remove('hidden');
    userPhoto.src = currentUser.photoURL;
    userName.textContent = currentUser.displayName;
    mainContent.classList.remove('hidden');
    welcomeScreen.classList.add('hidden');
}

function showWelcome() {
    loginBtn.classList.remove('hidden');
    userProfile.classList.add('hidden');
    mainContent.classList.add('hidden');
    welcomeScreen.classList.remove('hidden');
    memoList.innerHTML = '';
}

// Firestore Logic
saveBtn.onclick = async () => {
    const content = memoInput.value.trim();
    if (!content) return;

    saveBtn.disabled = true;
    try {
        await addDoc(collection(db, `users/${currentUser.uid}/memos`), {
            content,
            createdAt: serverTimestamp()
        });
        memoInput.value = '';
    } catch (e) {
        console.error("Error adding document: ", e);
    } finally {
        saveBtn.disabled = false;
    }
};

function loadMemos() {
    loading.classList.remove('hidden');
    const q = query(
        collection(db, `users/${currentUser.uid}/memos`), 
        orderBy("createdAt", "desc")
    );

    unsubscribeMemos = onSnapshot(q, (snapshot) => {
        memoList.innerHTML = '';
        loading.classList.add('hidden');
        
        if (snapshot.empty) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            snapshot.forEach((docSnap) => {
                const memo = docSnap.data();
                renderMemo(docSnap.id, memo);
            });
        }
    });
}

function renderMemo(id, memo) {
    const card = document.createElement('div');
    card.className = 'memo-card';
    
    const date = memo.createdAt ? new Date(memo.createdAt.seconds * 1000).toLocaleString() : 'Saving...';

    card.innerHTML = `
        <div class="memo-content">${memo.content}</div>
        <div class="memo-footer">
            <span>${date}</span>
            <div class="memo-actions">
                <button class="btn-icon delete-btn" title="삭제">
                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </div>
        </div>
    `;

    card.querySelector('.delete-btn').onclick = async () => {
        if (confirm('정말로 이 메모를 삭제하시겠습니까?')) {
            await deleteDoc(doc(db, `users/${currentUser.uid}/memos`, id));
        }
    };

    memoList.appendChild(card);
}
