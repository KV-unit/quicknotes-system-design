const API_URL = 'https://jsonplaceholder.typicode.com/posts';

const loadBtn = document.getElementById('load-btn');
const statusEl = document.getElementById('status');
const notesList = document.getElementById('notes-list');
const noteForm = document.getElementById('note-form');
const titleInput = document.getElementById('title-input');
const bodyInput = document.getElementById('body-input');
const submitBtn = document.getElementById('submit-btn');

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

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => deleteNote(note.id, li, deleteBtn));

        li.appendChild(titleEl);
        li.appendChild(bodyEl);
        li.appendChild(deleteBtn);
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

function validateTitle(title) {
    if (!title) {
        return 'A title is required.';
    }
    if (title.length > 100) {
        return 'Title must be 100 characters or fewer.';
    }
    return null;
}

async function createNote(title, body) {
    submitBtn.disabled = true;
    setStatus('Saving note...', 'loading');

    try {
        const newNote = await request(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body, userId: 1 })
        });

        // JSONPlaceholder fakes the create: it returns a realistic new id
        // (e.g. 101) but does not actually persist the note server-side.
        // We treat its response as the source of truth for what gets added
        // to our local list, the same way a client would trust a real API.
        notes = [newNote, ...notes];
        renderNotes();
        setStatus(`Note created (status 201, id ${newNote.id}).`, 'success');
        noteForm.reset();
    } catch (error) {
        setStatus(`Error: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
    }
}

async function deleteNote(id, listItem, deleteBtn) {
    deleteBtn.disabled = true;
    setStatus('Deleting note...', 'loading');

    try {
        await request(`${API_URL}/${id}`, { method: 'DELETE' });

        // JSONPlaceholder doesn't really delete anything server-side either;
        // a successful response here just simulates what a real API would
        // confirm. We treat that confirmation as the signal to remove the
        // note from our local state and the DOM.
        notes = notes.filter(note => note.id !== id);
        listItem.remove();
        setStatus('Note deleted.', 'success');

        if (notes.length === 0) {
            renderNotes();
        }
    } catch (error) {
        setStatus(`Error: ${error.message}`, 'error');
        deleteBtn.disabled = false;
    }
}

loadBtn.addEventListener('click', loadNotes);

noteForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const title = titleInput.value.trim();
    const body = bodyInput.value.trim();
    const validationError = validateTitle(title);

    if (validationError) {
        setStatus(validationError, 'error');
        return;
    }

    createNote(title, body);
});
