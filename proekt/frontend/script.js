document.addEventListener('DOMContentLoaded', () => {
    // Элементы интерфейса
    const recordButton = document.getElementById('recordButton');
    const timerDisplay = document.getElementById('timer');
    const audioPlayback = document.getElementById('audioPlayback');
    const noteTagsInput = document.getElementById('noteTags');
    const reminderDateInput = document.getElementById('reminderDate');
    const saveNoteBtn = document.getElementById('saveNoteBtn');
    const searchInput = document.getElementById('searchInput');
    const dateFilter = document.getElementById('dateFilter');
    const notesList = document.getElementById('notesList');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const regName = document.getElementById('regName');
    const regEmail = document.getElementById('regEmail');
    const regPassword = document.getElementById('regPassword');
    const regConfirmPassword = document.getElementById('regConfirmPassword');

    // Настройки API
    const API_BASE_URL = "http://localhost:8000";
    let authToken = null;
    let currentUser = null;

    // Переменные для записи аудио
    let mediaRecorder;
    let audioChunks = [];
    let recordingStartTime;
    let timerInterval;

    // Инициализация приложения
    checkAuthStatus();

    // Обработчики событий
    recordButton.addEventListener('click', toggleRecording);
    saveNoteBtn.addEventListener('click', saveNote);
    searchInput.addEventListener('input', () => renderNotes(searchInput.value));
    dateFilter.addEventListener('change', () => renderNotes(searchInput.value, dateFilter.value));

    // Функции
    async function checkAuthStatus() {
        const token = localStorage.getItem('authToken');
        if (token) {
            authToken = token;
            currentUser = JSON.parse(localStorage.getItem('currentUser'));
            initApp();
        }
    }

    async function login(email, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
            });

            if (!response.ok) {
                throw new Error('Ошибка входа');
            }

            const data = await response.json();
            authToken = data.access_token;
            currentUser = { email: email };

            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentUser', JSON.stringify(currentUser));

            initApp();
            return true;
        } catch (error) {
            console.error('Ошибка входа:', error);
            alert('Неверный email или пароль');
            return false;
        }
    }

    async function register(name, email, password) {
        try {
            const response = await fetch(`${API_BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: name,
                    email: email,
                    password: password
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ошибка регистрации');
            }

            alert('Регистрация успешна! Теперь вы можете войти.');
            return true;
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            alert(error.message);
            return false;
        }
    }

    function initApp() {
        // Скрываем формы авторизации, показываем основное приложение
        loginForm.style.display = 'none';
        registerForm.style.display = 'none';
        document.querySelector('.recording-section').style.display = 'block';
        document.querySelector('.notes-section').style.display = 'block';

        // Загружаем заметки пользователя
        renderNotes();
    }

    async function toggleRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopRecording();
        } else {
            await startRecording();
        }
    }

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            
            mediaRecorder.ondataavailable = event => {
                audioChunks.push(event.data);
            };
            
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                const audioUrl = URL.createObjectURL(audioBlob);
                audioPlayback.src = audioUrl;
                audioPlayback.style.display = 'block';
                saveNoteBtn.disabled = false;
            };
            
            audioChunks = [];
            mediaRecorder.start(100); // Записываем кусочки по 100 мс
            recordButton.textContent = '⏹️ Остановить запись';
            recordButton.classList.add('recording');
            
            // Таймер
            recordingStartTime = Date.now();
            timerInterval = setInterval(updateTimer, 1000);
            updateTimer();
            
        } catch (error) {
            console.error('Ошибка доступа к микрофону:', error);
            alert(`Ошибка доступа к микрофону: ${error.message}`);
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
            clearInterval(timerInterval);
            recordButton.textContent = '🎤 Начать запись';
            recordButton.classList.remove('recording');
            
            // Остановка всех треков потока
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
        }
    }

    function updateTimer() {
        const elapsedTime = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsedTime / 60).toString().padStart(2, '0');
        const seconds = (elapsedTime % 60).toString().padStart(2, '0');
        timerDisplay.textContent = `${minutes}:${seconds}`;
    }

    async function saveNote() {
        if (!audioChunks.length) return;
        
        const tags = noteTagsInput.value;
        const reminder = reminderDateInput.value;
        
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('file', audioBlob, 'recording.wav');
        formData.append('tags', tags);
        if (reminder) formData.append('reminder', reminder);
        
        try {
            const response = await fetch(`${API_BASE_URL}/notes/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error('Ошибка сохранения заметки');
            }
            
            // Сброс формы
            audioChunks = [];
            audioPlayback.style.display = 'none';
            audioPlayback.src = '';
            noteTagsInput.value = '';
            reminderDateInput.value = '';
            saveNoteBtn.disabled = true;
            timerDisplay.textContent = '00:00';
            
            // Обновление списка заметок
            renderNotes();
            
        } catch (error) {
            console.error('Ошибка:', error);
            alert(error.message);
        }
    }

    async function renderNotes(searchTerm = '', dateFilterValue = 'all') {
        try {
            const response = await fetch(`${API_BASE_URL}/notes/`, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Ошибка загрузки заметок');
            }
            
            let notes = await response.json();
            
            // Фильтрация на клиенте
            if (searchTerm) {
                const searchTerms = searchTerm.toLowerCase().split(' ').filter(t => t);
                notes = notes.filter(note => 
                    searchTerms.some(term => 
                        note.tags.toLowerCase().includes(term))
                );
            }
            
            if (dateFilterValue !== 'all') {
                notes = notes.filter(note => {
                    const noteDate = new Date(note.created_at).toISOString().split('T')[0];
                    return noteDate === dateFilterValue;
                });
            }
            
            // Отрисовка заметок
            if (notes.length === 0) {
                notesList.innerHTML = '<div class="empty-state">Нет заметок. Начните запись!</div>';
                return;
            }
            
            notesList.innerHTML = '';
            notes.forEach(note => {
                const noteElement = document.createElement('div');
                noteElement.className = 'note-card';
                
                const date = new Date(note.created_at);
                const formattedDate = date.toLocaleString();
                
                // Проверка напоминания
                let reminderElement = '';
                if (note.reminder) {
                    const reminderDate = new Date(note.reminder);
                    const now = new Date();
                    
                    if (reminderDate > now) {
                        reminderElement = `
                            <div class="note-reminder">
                                ⏰ ${reminderDate.toLocaleString()}
                            </div>
                        `;
                    } else {
                        reminderElement = `
                            <div class="note-reminder" style="color: var(--danger-color)">
                                ⚠️ Просрочено: ${reminderDate.toLocaleString()}
                            </div>
                        `;
                    }
                }
                
                // Добавляем кнопку для транскрибации
                let transcribeBtn = '';
                if (!note.transcription) {
                    transcribeBtn = `<button class="action-btn transcribe-btn" data-id="${note.id}">✍️ Транскрибировать</button>`;
                } else {
                    transcribeBtn = `<div class="transcription">${note.transcription}</div>`;
                }
                
                noteElement.innerHTML = `
                    <div class="note-header">
                        <div class="note-date">${formattedDate}</div>
                    </div>
                    
                    <audio src="${API_BASE_URL}/${note.audio_path.replace(/\\/g, '/')}" controls></audio>
                    
                    ${reminderElement}
                    
                    <div class="note-tags">
                        ${note.tags.split(',').map(tag => `<span class="tag">${tag.trim()}</span>`).join('')}
                    </div>
                    
                    ${transcribeBtn}
                    
                    <div class="note-actions">
                        <button class="action-btn delete-btn" data-id="${note.id}">🗑️ Удалить</button>
                    </div>
                `;
                
                notesList.appendChild(noteElement);
            });
            
            // Добавляем обработчики для кнопок
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const noteId = e.target.getAttribute('data-id');
                    deleteNote(noteId);
                });
            });
            
            document.querySelectorAll('.transcribe-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const noteId = e.target.getAttribute('data-id');
                    transcribeNote(noteId);
                });
            });
            
        } catch (error) {
            console.error(error);
            notesList.innerHTML = '<div class="empty-state">Ошибка загрузки заметок</div>';
        }
    }

    async function transcribeNote(noteId) {
        try {
            const response = await fetch(`${API_BASE_URL}/notes/${noteId}/transcribe`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Ошибка транскрибации');
            }
            
            const result = await response.json();
            alert(`Транскрипция: ${result.transcription}`);
            renderNotes();
            
        } catch (error) {
            console.error('Ошибка:', error);
            alert(error.message);
        }
    }

    async function deleteNote(noteId) {
        if (confirm('Вы уверены, что хотите удалить эту заметку?')) {
            try {
                const response = await fetch(`${API_BASE_URL}/notes/${noteId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                
                if (!response.ok) {
                    throw new Error('Ошибка удаления заметки');
                }
                
                renderNotes();
                
            } catch (error) {
                console.error('Ошибка:', error);
                alert(error.message);
            }
        }
    }

    // Обработчики для форм авторизации
    document.getElementById('loginBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        const success = await login(loginEmail.value, loginPassword.value);
        if (success) {
            loginEmail.value = '';
            loginPassword.value = '';
        }
    });

    document.getElementById('registerBtn').addEventListener('click', async (e) => {
        e.preventDefault();
        if (regPassword.value !== regConfirmPassword.value) {
            alert('Пароли не совпадают');
            return;
        }
        const success = await register(regName.value, regEmail.value, regPassword.value);
        if (success) {
            regName.value = '';
            regEmail.value = '';
            regPassword.value = '';
            regConfirmPassword.value = '';
            document.getElementById('showLogin').click();
        }
    });

    // Переключение между формами входа и регистрации
    document.getElementById('showRegister').addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
    });

    document.getElementById('showLogin').addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.style.display = 'none';
        loginForm.style.display = 'block';
    });
});