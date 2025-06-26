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
    
    // Переменные состояния
    let mediaRecorder;
    let audioChunks = [];
    let recordingStartTime;
    let timerInterval;
    let notes = JSON.parse(localStorage.getItem('audioNotes')) || [];
    
    // Инициализация приложения
    initDateFilter();
    renderNotes();
    
    // Обработчики событий
    recordButton.addEventListener('click', toggleRecording);
    saveNoteBtn.addEventListener('click', saveNote);
    searchInput.addEventListener('input', () => renderNotes(searchInput.value));
    dateFilter.addEventListener('change', () => renderNotes(searchInput.value, dateFilter.value));
    
    // Функции
    
    function initDateFilter() {
        // Получаем уникальные даты из заметок
        const dates = [...new Set(notes.map(note => {
            const date = new Date(note.timestamp);
            return date.toISOString().split('T')[0];
        }))].sort((a, b) => new Date(b) - new Date(a));
        
        // Очищаем и добавляем опции
        dateFilter.innerHTML = '<option value="all">Все даты</option>';
        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = new Date(date).toLocaleDateString();
            dateFilter.appendChild(option);
        });
    }
    
    function toggleRecording() {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopRecording();
        } else {
            startRecording();
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
            mediaRecorder.start();
            recordButton.textContent = '⏹️ Остановить запись';
            recordButton.classList.add('recording');
            
            // Таймер
            recordingStartTime = Date.now();
            timerInterval = setInterval(updateTimer, 1000);
            updateTimer();
            
        } catch (error) {
            console.error('Ошибка доступа к микрофону:', error);
            alert('Не удалось получить доступ к микрофону. Пожалуйста, проверьте разрешения.');
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
    
    function saveNote() {
        if (!audioChunks.length) return;
        
        const tags = noteTagsInput.value
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0);
        
        const reminder = reminderDateInput.value ? new Date(reminderDateInput.value).getTime() : null;
        
        const newNote = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            audioUrl: audioPlayback.src,
            tags,
            reminder
        };
        
        notes.unshift(newNote);
        saveNotesToLocalStorage();
        
        // Сброс формы
        audioChunks = [];
        audioPlayback.style.display = 'none';
        audioPlayback.src = '';
        noteTagsInput.value = '';
        reminderDateInput.value = '';
        saveNoteBtn.disabled = true;
        timerDisplay.textContent = '00:00';
        
        // Обновление интерфейса
        initDateFilter();
        renderNotes();
    }
    
    function saveNotesToLocalStorage() {
        localStorage.setItem('audioNotes', JSON.stringify(notes));
    }
    
    function renderNotes(searchTerm = '', dateFilterValue = 'all') {
        let filteredNotes = [...notes];
        
        // Фильтрация по поисковому запросу (тегам)
        if (searchTerm) {
            const searchTerms = searchTerm.toLowerCase().split(' ').filter(t => t);
            filteredNotes = filteredNotes.filter(note => 
                searchTerms.some(term => 
                    note.tags.some(tag => tag.toLowerCase().includes(term))
                )
            );
        }
        
        // Фильтрация по дате
        if (dateFilterValue !== 'all') {
            filteredNotes = filteredNotes.filter(note => {
                const noteDate = new Date(note.timestamp).toISOString().split('T')[0];
                return noteDate === dateFilterValue;
            });
        }
        
        // Отрисовка заметок
        if (filteredNotes.length === 0) {
            notesList.innerHTML = '<div class="empty-state">Нет заметок. Начните запись!</div>';
            return;
        }
        
        notesList.innerHTML = '';
        filteredNotes.forEach(note => {
            const noteElement = document.createElement('div');
            noteElement.className = 'note-card';
            
            const date = new Date(note.timestamp);
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
            
            noteElement.innerHTML = `
                <div class="note-header">
                    <div class="note-date">${formattedDate}</div>
                </div>
                
                <audio src="${note.audioUrl}" controls></audio>
                
                ${reminderElement}
                
                <div class="note-tags">
                    ${note.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
                
                <div class="note-actions">
                    <button class="action-btn delete-btn" data-id="${note.id}">🗑️ Удалить</button>
                </div>
            `;
            
            notesList.appendChild(noteElement);
        });
        
        // Добавляем обработчики для кнопок удаления
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const noteId = e.target.getAttribute('data-id');
                deleteNote(noteId);
            });
        });
    }
    
    function deleteNote(noteId) {
        if (confirm('Вы уверены, что хотите удалить эту заметку?')) {
            notes = notes.filter(note => note.id !== noteId);
            saveNotesToLocalStorage();
            initDateFilter();
            renderNotes(searchInput.value, dateFilter.value);
        }
    }
});