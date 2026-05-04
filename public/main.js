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
const memoCategory = document.getElementById('memo-category');
const memoTitle = document.getElementById('memo-title');
const memoDate = document.getElementById('memo-date');
const memoTime = document.getElementById('memo-time');
const textColorPicker = document.getElementById('text-color');
const memoBgColorPicker = document.getElementById('memo-bg-color');

const saveBtn = document.getElementById('save-btn');
const memoList = document.getElementById('memo-list');
const emptyState = document.getElementById('empty-state');
const loading = document.getElementById('loading');
const searchInput = document.getElementById('search-input');
const searchReset = document.getElementById('search-reset');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const voiceBtn = document.getElementById('voice-btn');

const fontFamilySelect = document.getElementById('font-family');
const fontSizeSelect = document.getElementById('font-size');

// Set default date and time
const now = new Date();
memoDate.value = now.toISOString().split('T')[0];
memoTime.value = now.toTimeString().split(' ')[0].substring(0, 5);


// Speech Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    const recognition = new SpeechRecognition();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;

    voiceBtn.onclick = () => {
        try {
            recognition.start();
        } catch (e) {
            console.error('Recognition already started or error:', e);
        }
    };

    recognition.onstart = () => {
        voiceBtn.textContent = '음성 인식 중...';
        voiceBtn.classList.add('recording');
    };


    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        memoInput.focus();
        document.execCommand('insertText', false, transcript);
        
        // Update undo stack
        if (memoInput.oninput) memoInput.oninput();
    };


    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
    };

    recognition.onend = () => {
        voiceBtn.textContent = '음성으로 입력하기';
        voiceBtn.classList.remove('recording');
    };

} else {
    voiceBtn.style.display = 'none';
}

let currentUser = null;
let unsubscribeMemos = null;
let editingMemoId = null;
let allMemos = [];

// Undo/Redo Logic
let undoStack = [memoInput.innerHTML];
let redoStack = [];

memoInput.oninput = () => {
    if (memoInput.innerHTML !== undoStack[undoStack.length - 1]) {
        undoStack.push(memoInput.innerHTML);
        if (undoStack.length > 50) undoStack.shift();
        redoStack = [];
    }
};

undoBtn.onclick = () => {
    if (undoStack.length > 1) {
        redoStack.push(undoStack.pop());
        memoInput.innerHTML = undoStack[undoStack.length - 1];
    }
};

redoBtn.onclick = () => {
    if (redoStack.length > 0) {
        const next = redoStack.pop();
        undoStack.push(next);
        memoInput.innerHTML = next;
    }
};

// Color Pickers
textColorPicker.oninput = () => {
    document.execCommand('foreColor', false, textColorPicker.value);
};

memoBgColorPicker.oninput = () => {
    memoInput.style.backgroundColor = memoBgColorPicker.value;
};


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

// Search Logic
searchInput.oninput = () => {
    if (searchInput.value) {
        searchReset.classList.remove('hidden');
    } else {
        searchReset.classList.add('hidden');
    }
    renderFilteredMemos();
};

searchReset.onclick = () => {
    searchInput.value = '';
    searchReset.classList.add('hidden');
    renderFilteredMemos();
};

function renderFilteredMemos() {
    const searchTerm = searchInput.value.toLowerCase();
    memoList.innerHTML = '';
    
    const filtered = allMemos.filter(m => {
        const content = (m.data.content || '').toLowerCase();
        const title = (m.data.title || '').toLowerCase();
        const category = (m.data.category || '').toLowerCase();
        return content.includes(searchTerm) || title.includes(searchTerm) || category.includes(searchTerm);
    });
    
    if (filtered.length === 0) {
        emptyState.classList.remove('hidden');
        emptyState.querySelector('p').textContent = searchTerm ? '검색 결과가 없습니다.' : '작성된 메모가 없습니다. 첫 메모를 작성해보세요!';
    } else {
        emptyState.classList.add('hidden');
        filtered.forEach((m) => {
            renderMemo(m.id, m.data);
        });
    }
}


// Firestore Logic
saveBtn.onclick = async () => {
    const content = memoInput.innerHTML.trim();
    if (!content || content === '<br>') return;

    const category = memoCategory.value.trim();
    const title = memoTitle.value.trim();
    const date = memoDate.value;
    const time = memoTime.value;
    const backgroundColor = memoInput.style.backgroundColor || '#1e293b';
    const fontFamily = fontFamilySelect.value;
    const fontSize = fontSizeSelect.value;

    saveBtn.disabled = true;
    try {
        const memoData = {
            content,
            category,
            title,
            date,
            time,
            backgroundColor,
            fontFamily,
            fontSize,
            updatedAt: serverTimestamp()
        };

        if (editingMemoId) {
            await updateDoc(doc(db, `users/${currentUser.uid}/memos`, editingMemoId), memoData);
            editingMemoId = null;
            saveBtn.textContent = '저장';
        } else {
            memoData.createdAt = serverTimestamp();
            await addDoc(collection(db, `users/${currentUser.uid}/memos`), memoData);
        }
        
        // Reset inputs
        memoInput.innerHTML = '';
        memoCategory.value = '';
        memoTitle.value = '';
        memoInput.style.backgroundColor = '#1e293b';
        const now = new Date();
        memoDate.value = now.toISOString().split('T')[0];
        memoTime.value = now.toTimeString().split(' ')[0].substring(0, 5);
        
    } catch (e) {
        console.error("Error saving document: ", e);
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
        loading.classList.add('hidden');
        allMemos = snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
        renderFilteredMemos();
    });
}

function renderMemo(id, memo) {
    const card = document.createElement('div');
    card.className = 'memo-card';
    card.style.backgroundColor = memo.backgroundColor || 'var(--card-bg)';
    
    const displayDate = memo.date || (memo.createdAt ? new Date(memo.createdAt.seconds * 1000).toLocaleDateString() : 'Saving...');
    const displayTime = memo.time || '';

    const storageDateObj = memo.updatedAt || memo.createdAt;
    const storageDateStr = storageDateObj ? new Date(storageDateObj.seconds * 1000).toLocaleString('ko-KR', { hour12: false }) : 'Saving...';


    card.innerHTML = `
        <div class="memo-header">
            <div class="memo-meta">
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    ${memo.category ? `<span class="memo-category-badge">${memo.category}</span>` : ''}
                    ${memo.title ? `<h3 class="memo-card-title" style="margin: 0; font-size: 0.9rem;">${memo.title}</h3>` : ''}
                    <span class="memo-date-text" style="margin-left: 0.5rem;">${displayDate} ${displayTime}</span>
                </div>
            </div>

            <div class="memo-actions">
                <button class="btn-icon edit-btn" title="수정">
                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                    </svg>
                </button>
                <button class="btn-icon delete-btn" title="삭제">
                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                    </svg>
                </button>
            </div>
        </div>
        <div class="memo-content" style="font-family: ${memo.fontFamily || 'inherit'}; font-size: ${memo.fontSize || 'inherit'};">${memo.content}</div>
        <div class="memo-storage-footer">저장 일시: ${storageDateStr}</div>
    `;



    card.querySelector('.edit-btn').onclick = () => {
        memoInput.innerHTML = memo.content;
        memoCategory.value = memo.category || '';
        memoTitle.value = memo.title || '';
        memoDate.value = memo.date || '';
        memoTime.value = memo.time || '';
        memoInput.style.backgroundColor = memo.backgroundColor || '#1e293b';
        fontFamilySelect.value = memo.fontFamily || "'Malgun Gothic', sans-serif";
        fontSizeSelect.value = memo.fontSize || "9pt";
        editingMemoId = id;
        saveBtn.textContent = '수정 완료';
        memoInput.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };


    card.querySelector('.delete-btn').onclick = async () => {
        if (confirm('정말로 이 메모를 삭제하시겠습니까?')) {
            await deleteDoc(doc(db, `users/${currentUser.uid}/memos`, id));
        }
    };

    memoList.appendChild(card);
}
