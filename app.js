// ===== NEW CHAT FUNCTIONALITY =====
async function showNewChatModal() {
    document.getElementById('new-chat-modal').classList.remove('hidden');
    await loadAvailableUsers();
}

async function loadAvailableUsers() {
    try {
        const usersList = document.getElementById('users-list');
        usersList.innerHTML = '';
        
        const usersSnapshot = await db.collection('users').get();
        
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            // Jangan tampilkan user sendiri
            if (user.username !== currentUser.username) {
                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                userItem.innerHTML = `
                    <img src="${user.avatar}" alt="${user.displayName}" style="width: 40px; height: 40px; border-radius: 50%;">
                    <div>
                        <div style="font-weight: 600;">${user.displayName}</div>
                        <div style="font-size: 12px; color: #666;">@${user.username}</div>
                    </div>
                `;
                
                userItem.addEventListener('click', () => createDirectChat(user));
                usersList.appendChild(userItem);
            }
        });
        
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

async function createDirectChat(otherUser) {
    try {
        // Cek apakah conversation sudah ada
        const existingChat = await db.collection('conversations')
            .where('participants', 'array-contains', currentUser.username)
            .where('type', '==', 'direct')
            .get();
            
        let conversationId;
        let conversationExists = false;
        
        // Cek apakah chat dengan user ini sudah ada
        existingChat.forEach(doc => {
            const conv = doc.data();
            if (conv.participants.includes(otherUser.username)) {
                conversationId = doc.id;
                conversationExists = true;
            }
        });
        
        if (!conversationExists) {
            // Buat conversation baru
            const newConversation = {
                type: 'direct',
                participants: [currentUser.username, otherUser.username],
                name: `${otherUser.displayName}`,
                avatar: otherUser.avatar,
                createdBy: currentUser.username,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
                lastMessage: null,
                unreadCount: 0
            };
            
            const docRef = await db.collection('conversations').add(newConversation);
            conversationId = docRef.id;
        }
        
        // Buka conversation
        const conversation = {
            id: conversationId,
            type: 'direct',
            participants: [currentUser.username, otherUser.username],
            name: otherUser.displayName,
            avatar: otherUser.avatar
        };
        
        openConversation(conversation);
        closeAllModals();
        
    } catch (error) {
        console.error('Error creating chat:', error);
        showNotification('Gagal membuat percakapan', 'error');
    }
}

// ===== GROUP CHAT FUNCTIONALITY =====
async function showCreateGroupModal() {
    document.getElementById('create-group-modal').classList.remove('hidden');
    await loadAvailableUsersForGroup();
}

async function loadAvailableUsersForGroup() {
    try {
        const availableUsers = document.getElementById('available-users');
        availableUsers.innerHTML = '';
        
        const usersSnapshot = await db.collection('users').get();
        
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            // Jangan tampilkan user sendiri
            if (user.username !== currentUser.username) {
                const userItem = document.createElement('div');
                userItem.className = 'user-item';
                userItem.innerHTML = `
                    <img src="${user.avatar}" alt="${user.displayName}" style="width: 40px; height: 40px; border-radius: 50%;">
                    <div>
                        <div style="font-weight: 600;">${user.displayName}</div>
                        <div style="font-size: 12px; color: #666;">@${user.username}</div>
                    </div>
                `;
                
                userItem.addEventListener('click', () => addUserToGroup(user));
                availableUsers.appendChild(userItem);
            }
        });
        
    } catch (error) {
        console.error('Error loading users for group:', error);
    }
}

let selectedGroupUsers = [];

function addUserToGroup(user) {
    // Cek apakah user sudah dipilih
    if (!selectedGroupUsers.find(u => u.username === user.username)) {
        selectedGroupUsers.push(user);
        updateSelectedUsersList();
    }
}

function updateSelectedUsersList() {
    const selectedUsersList = document.getElementById('selected-users-list');
    selectedUsersList.innerHTML = '';
    
    selectedGroupUsers.forEach(user => {
        const userTag = document.createElement('div');
        userTag.className = 'selected-user-tag';
        userTag.innerHTML = `
            ${user.displayName}
            <button class="remove-user" onclick="removeUserFromGroup('${user.username}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        selectedUsersList.appendChild(userTag);
    });
}

function removeUserFromGroup(username) {
    selectedGroupUsers = selectedGroupUsers.filter(user => user.username !== username);
    updateSelectedUsersList();
}

async function createGroup() {
    const groupName = document.getElementById('group-name').value.trim();
    const groupDescription = document.getElementById('group-description').value.trim();
    
    if (!groupName) {
        showNotification('Nama group harus diisi!', 'error');
        return;
    }
    
    if (selectedGroupUsers.length === 0) {
        showNotification('Pilih minimal 1 anggota group!', 'error');
        return;
    }
    
    try {
        // Siapkan participants (termasuk creator)
        const participants = [currentUser.username, ...selectedGroupUsers.map(user => user.username)];
        
        // Buat group conversation
        const newGroup = {
            type: 'group',
            participants: participants,
            name: groupName,
            description: groupDescription,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName)}&background=764ba2&color=fff`,
            createdBy: currentUser.username,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastActivity: firebase.firestore.FieldValue.serverTimestamp(),
            lastMessage: null,
            unreadCount: 0,
            admins: [currentUser.username]
        };
        
        const docRef = await db.collection('conversations').add(newGroup);
        
        // Reset form
        document.getElementById('group-name').value = '';
        document.getElementById('group-description').value = '';
        selectedGroupUsers = [];
        updateSelectedUsersList();
        
        // Buka group chat
        const conversation = {
            id: docRef.id,
            type: 'group',
            participants: participants,
            name: groupName,
            avatar: newGroup.avatar
        };
        
        openConversation(conversation);
        closeAllModals();
        showNotification('Group berhasil dibuat!', 'success');
        
    } catch (error) {
        console.error('Error creating group:', error);
        showNotification('Gagal membuat group', 'error');
    }
}

// ===== USER SEARCH FUNCTIONALITY =====
function searchUsers() {
    const searchTerm = document.getElementById('search-user').value.toLowerCase();
    const userItems = document.querySelectorAll('#users-list .user-item');
    
    userItems.forEach(item => {
        const userName = item.textContent.toLowerCase();
        if (userName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function searchAvailableUsers() {
    const searchTerm = document.getElementById('search-member').value.toLowerCase();
    const userItems = document.querySelectorAll('#available-users .user-item');
    
    userItems.forEach(item => {
        const userName = item.textContent.toLowerCase();
        if (userName.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}