const API_URL = 'https://jsonplaceholder.typicode.com/posts';

const loadBtn = document.getElementById('load-btn');
const statusEl = document.getElementById('status');
const notesList = document.getElementById('notes-list');

let notes = [];

// Reusable request helper: calls fetch, checks response.ok, and throws a
// descriptive error if the response was not successful. Every function
// below goes through this so we only have to handle fetch's quirks once.
async function request(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
    }

    // DELETE requests on this API return an empty body; guard against that
    // so JSON.parse doesn't blow up on an empty string.
    const text = await response.text();
    return text ? JSON.parse(text) : null;
}

function setStatus(message, type) {
    statusEl.textContent = message;
    statusEl.className = type ? `status-${type}` : '';
}

function renderNotes() {
    notesList.innerHTML = '';

    if (notes.length === 0) {
        const emptyItem = document.createElement('li');
        emptyItem.className = 'empty-state';
        emptyItem.textContent = 'No notes yet.';
        notesList.appendChild(emptyItem);
        return;
    }

    notes.forEach(note => {
        const li = document.createElement('li');
        li.className = 'note-item';
        li.dataset.id = note.id;

        const titleEl = document.createElement('h3');
        titleEl.textContent = note.title;

        const bodyEl = document.createElement('p');
        bodyEl.textContent = note.body;

        li.appendChild(titleEl);
        li.appendChild(bodyEl);
        notesList.appendChild(li);
    });
}

async function loadNotes() {
    loadBtn.disabled = true;
    setStatus('Loading notes...', 'loading');

    try {
        const data = await request(`${API_URL}?_limit=10`);
        notes = data;
        renderNotes();
        setStatus(`Loaded ${notes.length} notes from the server.`, 'success');
    } catch (error) {
        setStatus(`Error: ${error.message}`, 'error');
    } finally {
        loadBtn.disabled = false;
    }
}

loadBtn.addEventListener('click', loadNotes);
