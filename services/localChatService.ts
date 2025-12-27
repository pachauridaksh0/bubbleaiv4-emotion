
import { Chat, Message, Project, ChatWithProjectData, ProjectPlatform, ProjectType } from '../types';

const STORAGE_KEYS = {
    CHATS: 'guest_chats',
    MESSAGES: 'guest_messages',
    PROJECTS: 'guest_projects'
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export const localChatService = {
    // === PROJECTS ===
    async getProjects(): Promise<Project[]> {
        await delay(50);
        return JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
    },

    async createProject(name: string, platform: ProjectPlatform, projectType: ProjectType, description?: string): Promise<Project> {
        await delay(50);
        const projects = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
        const newProject: Project = {
            id: `guest-proj-${Date.now()}`,
            user_id: 'guest',
            name,
            description: description || 'Guest Project',
            platform,
            project_type: projectType,
            status: 'In Progress',
            default_model: 'gemini-2.5-flash',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            files: {}
        };
        projects.unshift(newProject);
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
        return newProject;
    },

    async updateProject(projectId: string, updates: Partial<Project>): Promise<Project> {
        const projects = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
        const index = projects.findIndex((p: Project) => p.id === projectId);
        if (index === -1) throw new Error("Project not found");
        
        const updatedProject = { ...projects[index], ...updates, updated_at: new Date().toISOString() };
        projects[index] = updatedProject;
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
        return updatedProject;
    },

    async deleteProject(projectId: string): Promise<void> {
        let projects = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
        projects = projects.filter((p: Project) => p.id !== projectId);
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
        
        // Cascade delete chats
        const chats = await this.getAllChats();
        const projectChats = chats.filter(c => c.project_id === projectId);
        for (const chat of projectChats) {
            await this.deleteChat(chat.id);
        }
    },

    // === CHATS ===
    async getAllChats(): Promise<ChatWithProjectData[]> {
        await delay(50);
        const chats = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHATS) || '[]');
        const projects = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROJECTS) || '[]');
        
        return chats.map((c: Chat) => {
            const project = c.project_id ? projects.find((p: Project) => p.id === c.project_id) || null : null;
            return { ...c, projects: project };
        }).sort((a: Chat, b: Chat) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    },

    async createChat(name: string, mode: string, projectId?: string | null): Promise<Chat> {
        await delay(50);
        const chats = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHATS) || '[]');
        const newChat: Chat = {
            id: `guest-chat-${Date.now()}`,
            user_id: 'guest',
            project_id: projectId || null,
            name,
            mode: mode as any,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        chats.unshift(newChat);
        localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
        return newChat;
    },

    async updateChat(chatId: string, updates: Partial<Chat>): Promise<Chat> {
        const chats = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHATS) || '[]');
        const index = chats.findIndex((c: Chat) => c.id === chatId);
        if (index === -1) throw new Error("Chat not found");
        
        const updatedChat = { ...chats[index], ...updates, updated_at: new Date().toISOString() };
        chats[index] = updatedChat;
        localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));
        return updatedChat;
    },

    async deleteChat(chatId: string): Promise<void> {
        let chats = JSON.parse(localStorage.getItem(STORAGE_KEYS.CHATS) || '[]');
        chats = chats.filter((c: Chat) => c.id !== chatId);
        localStorage.setItem(STORAGE_KEYS.CHATS, JSON.stringify(chats));

        const allMessages = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '{}');
        delete allMessages[chatId];
        localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(allMessages));
    },

    // === MESSAGES ===
    async getMessages(chatId: string): Promise<Message[]> {
        await delay(50);
        const allMessages = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '{}');
        return allMessages[chatId] || [];
    },

    async addMessage(message: Omit<Message, 'id' | 'created_at'>): Promise<Message> {
        await delay(50);
        const allMessages = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '{}');
        const chatMessages = allMessages[message.chat_id] || [];
        
        const newMessage: Message = {
            ...message,
            id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            created_at: new Date().toISOString()
        };
        
        chatMessages.push(newMessage);
        allMessages[message.chat_id] = chatMessages;
        localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(allMessages));
        
        await this.updateChat(message.chat_id, {});
        
        return newMessage;
    },

    async updateMessage(messageId: string, updates: Partial<Message>): Promise<void> {
        const allMessages = JSON.parse(localStorage.getItem(STORAGE_KEYS.MESSAGES) || '{}');
        for (const chatId in allMessages) {
            const msgs = allMessages[chatId];
            const index = msgs.findIndex((m: Message) => m.id === messageId);
            if (index !== -1) {
                msgs[index] = { ...msgs[index], ...updates };
                allMessages[chatId] = msgs;
                localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(allMessages));
                return;
            }
        }
    }
};
