import os
import json
import requests
from flask import Flask, render_template_string, request, session, jsonify
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.secret_key = os.urandom(24)
API_KEY = os.getenv("DEEPSEEK_API_KEY")
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'txt', 'md', 'py', 'json', 'js', 'html', 'css'}

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DeepSeek Chat</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <style>
        :root { --bg: #1e1e1e; --chat-bg: #2d2d2d; --user-msg: #3b82f6; --ai-msg: #3d3d3d; --text: #e0e0e0; --input-bg: #252525; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); display: flex; flex-direction: column; height: 100vh; }
        #header { padding: 10px 15px; background: var(--input-bg); border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; }
        #header h1 { margin: 0; font-size: 1.2rem; }
        #settings-btn { background: none; border: 1px solid #555; color: var(--text); padding: 5px 10px; border-radius: 4px; cursor: pointer; }
        #chat-container { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 15px; }
        .message { max-width: 85%; padding: 12px 16px; border-radius: 12px; line-height: 1.5; position: relative; word-wrap: break-word; }
        .user { align-self: flex-end; background: var(--user-msg); color: white; }
        .assistant { align-self: flex-start; background: var(--ai-msg); }
        .message-actions { display: flex; gap: 5px; justify-content: flex-end; margin-top: 5px; opacity: 0.6; }
        .message-actions button { background: none; border: none; color: inherit; cursor: pointer; font-size: 0.8rem; padding: 2px 5px; }
        .message-actions button:hover { opacity: 1; text-decoration: underline; }
        .message pre { background: #111; padding: 10px; border-radius: 6px; overflow-x: auto; position: relative; margin: 10px 0; }
        .message code { font-family: "Consolas", monospace; font-size: 0.9em; }
        .copy-btn-inline { position: absolute; top: 5px; right: 5px; background: #444; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8em; }
        #input-area { padding: 15px; background: var(--input-bg); border-top: 1px solid #444; display: flex; flex-direction: column; gap: 10px; }
        #file-upload-container { display: flex; gap: 10px; align-items: center; font-size: 0.9rem; color: #aaa; }
        #prompt-input { width: 100%; padding: 12px; background: #333; border: 1px solid #555; color: white; border-radius: 8px; resize: none; height: 50px; box-sizing: border-box; }
        #send-btn { padding: 12px 20px; background: var(--user-msg); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; align-self: flex-end; }
        #send-btn:disabled { background: #555; cursor: not-allowed; }
        .markdown-body { color: inherit; }
        .markdown-body pre { margin: 10px 0; }
        .modal { display: none; position: fixed; z-index: 100; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); }
        .modal-content { background-color: var(--input-bg); margin: 15% auto; padding: 20px; border: 1px solid #444; width: 90%; max-width: 500px; border-radius: 8px; }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .close { color: #aaa; float: right; font-size: 28px; font-weight: bold; cursor: pointer; }
        .form-group { margin-bottom: 15px; }
        .form-group label { display: block; margin-bottom: 5px; color: #ccc; }
        .form-group input, .form-group textarea { width: 100%; padding: 8px; background: #333; border: 1px solid #555; color: white; border-radius: 4px; box-sizing: border-box; }
        .save-btn { background: var(--user-msg); color: white; border: none; padding: 10px 15px; border-radius: 4px; cursor: pointer; width: 100%; }
        .file-tag { background: #444; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; margin-left: 5px; }
    </style>
</head>
<body>
    <div id="header">
        <h1>DeepSeek</h1>
        <button id="settings-btn" onclick="openSettings()">⚙️ Settings</button>
    </div>
    <div id="chat-container"></div>
    <div id="input-area">
        <div id="file-upload-container">
            <input type="file" id="file-input" style="display:none" onchange="handleFileSelect(this)" multiple>
            <button onclick="document.getElementById('file-input').click()" style="background:#444;color:white;border:none;padding:5px 10px;border-radius:4px;cursor:pointer;">📎 Upload</button>
            <span id="file-name">No file selected</span>
        </div>
        <textarea id="prompt-input" placeholder="Type a message... (Enter for new line)"></textarea>
        <button id="send-btn" onclick="sendMessage()">Send</button>
    </div>
    <div id="settings-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Settings</h2>
                <span class="close" onclick="closeSettings()">&times;</span>
            </div>
            <div class="form-group">
                <label>System Prompt</label>
                <textarea id="setting-system" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>Temperature (0-1)</label>
                <input type="number" id="setting-temp" step="0.1" min="0" max="1" value="0.7">
            </div>
            <div class="form-group">
                <label>GitHub Repo (Context)</label>
                <input type="text" id="setting-github" placeholder="https://github.com/user/repo">
            </div>
            <button class="save-btn" onclick="saveSettings()">Save & Close</button>
            <button onclick="clearChat()" style="background:#d32f2f;color:white;border:none;padding:10px 15px;border-radius:4px;cursor:pointer;width:100%;margin-top:10px;">Clear Chat History</button>
        </div>
    </div>
    <script>
        const chatContainer = document.getElementById('chat-container');
        const promptInput = document.getElementById('prompt-input');
        const sendBtn = document.getElementById('send-btn');
        const fileNameSpan = document.getElementById('file-name');
        let selectedFiles = [];

        window.onload = async () => {
            const res = await fetch('/get_settings');
            const data = await res.json();
            document.getElementById('setting-system').value = data.system_prompt;
            document.getElementById('setting-temp').value = data.temperature;
            document.getElementById('setting-github').value = data.github_link || '';
            loadHistory();
        };

        function openSettings() { document.getElementById('settings-modal').style.display = "block"; }
        function closeSettings() { document.getElementById('settings-modal').style.display = "none"; }
        
        async function saveSettings() {
            const settings = {
                system_prompt: document.getElementById('setting-system').value,
                temperature: parseFloat(document.getElementById('setting-temp').value),
                github_link: document.getElementById('setting-github').value
            };
            await fetch('/save_settings', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(settings)
            });
            closeSettings();
        }

        function handleFileSelect(input) {
            if (input.files.length > 0) {
                selectedFiles = Array.from(input.files);
                fileNameSpan.textContent = selectedFiles.map(f => f.name).join(', ');
            } else {
                selectedFiles = [];
                fileNameSpan.textContent = "No file selected";
            }
        }

        function appendMessage(role, text) {
            const div = document.createElement('div');
            div.className = `message ${role}`;
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'message-actions';
            
            const copyBtn = document.createElement('button');
            copyBtn.innerText = 'Copy';
            copyBtn.onclick = () => {
                navigator.clipboard.writeText(text);
                copyBtn.innerText = 'Copied!';
                setTimeout(() => copyBtn.innerText = 'Copy', 2000);
            };
            
            const shareBtn = document.createElement('button');
            shareBtn.innerText = 'Share';
            shareBtn.onclick = () => {
                if (navigator.share) {
                    navigator.share({ title: 'Chat Response', text: text }).catch(console.error);
                } else {
                    navigator.clipboard.writeText(text);
                    shareBtn.innerText = 'Copied!';
                    setTimeout(() => shareBtn.innerText = 'Share', 2000);
                }
            };

            actionsDiv.appendChild(copyBtn);
            actionsDiv.appendChild(shareBtn);

            if (role === 'assistant') {
                const html = marked.parse(text);
                div.innerHTML = html;
                div.querySelectorAll('pre code').forEach((block) => {
                    hljs.highlightElement(block);
                    const pre = block.parentElement;
                    const btn = document.createElement('button');
                    btn.className = 'copy-btn-inline';
                    btn.innerText = 'Copy Code';
                    btn.onclick = () => {
                        navigator.clipboard.writeText(block.innerText);
                        btn.innerText = 'Copied!';
                        setTimeout(() => btn.innerText = 'Copy Code', 2000);
                    };
                    pre.appendChild(btn);
                });
            } else {
                div.textContent = text;
            }
            
            div.appendChild(actionsDiv);
            chatContainer.appendChild(div);
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }

        async function loadHistory() {
            const res = await fetch('/get_history');
            const data = await res.json();
            chatContainer.innerHTML = '';
            data.forEach(msg => appendMessage(msg.role, msg.content));
        }

        async function sendMessage() {
            const text = promptInput.value.trim();
            if (!text && selectedFiles.length === 0) return;
            
            const formData = new FormData();
            formData.append('message', text);
            selectedFiles.forEach(file => formData.append('files', file));
            
            let displayText = text;
            if (selectedFiles.length > 0) {
                displayText += ` [Attached: ${selectedFiles.map(f => f.name).join(', ')}]`;
            }
            
            appendMessage('user', displayText);
            promptInput.value = '';
            sendBtn.disabled = true;
            sendBtn.innerText = '...';

            try {
                const res = await fetch('/chat', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                appendMessage('assistant', data.response);
                selectedFiles = [];
                fileNameSpan.textContent = "No file selected";
                document.getElementById('file-input').value = '';
            } catch (e) {
                appendMessage('assistant', `Error: ${e.message}`);
            } finally {
                sendBtn.disabled = false;
                sendBtn.innerText = 'Send';
            }
        }

        async function clearChat() {
            await fetch('/clear', {method: 'POST'});
            chatContainer.innerHTML = '';
            closeSettings();
        }

        promptInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
            }
        });
    </script>
</body>
</html>
"""

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def fetch_github_context(repo_url):
    try:
        if "github.com" not in repo_url:
            return ""
        parts = repo_url.rstrip('/').split('/')
        if len(parts) < 2:
            return ""
        owner, repo = parts[-2], parts[-1]
        readme_url = f"https://raw.githubusercontent.com/{owner}/{repo}/main/README.md"
        resp = requests.get(readme_url, timeout=5)
        if resp.status_code == 200:
            return f"\n\n[GitHub Repo Context - README]:\n{resp.text[:2000]}"
        readme_url = f"https://raw.githubusercontent.com/{owner}/{repo}/master/README.md"
        resp = requests.get(readme_url, timeout=5)
        if resp.status_code == 200:
            return f"\n\n[GitHub Repo Context - README]:\n{resp.text[:2000]}"
    except:
        pass
    return ""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/get_settings')
def get_settings():
    return jsonify({
        'system_prompt': session.get('system_prompt', 'You are a helpful assistant.'),
        'temperature': session.get('temperature', 0.7),
        'github_link': session.get('github_link', '')
    })

@app.route('/save_settings', methods=['POST'])
def save_settings():
    data = request.json
    session['system_prompt'] = data.get('system_prompt', 'You are a helpful assistant.')
    session['temperature'] = data.get('temperature', 0.7)
    session['github_link'] = data.get('github_link', '')
    return jsonify({'status': 'ok'})

@app.route('/get_history')
def get_history():
    return jsonify(session.get('history', []))

@app.route('/chat', methods=['POST'])
def chat():
    if not API_KEY:
        return jsonify({'error': 'API Key missing'}), 500
    
    user_msg = request.form.get('message', '')
    files = request.files.getlist('files')
    file_content = ""
    
    for file in files:
        if file and file.filename != '' and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            filepath = os.path.join(UPLOAD_FOLDER, filename)
            file.save(filepath)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                file_content += f"\n\n[Attached File: {filename}]:\n{content[:5000]}"
            except:
                file_content += f"\n\n[Attached File: {filename}]: (Binary or unreadable)"

    system_prompt = session.get('system_prompt', 'You are a helpful assistant.')
    github_link = session.get('github_link', '')
    
    if github_link:
        gh_context = fetch_github_context(github_link)
        if gh_context:
            system_prompt += f"\n\nReference Codebase: {github_link} {gh_context}"
        else:
            system_prompt += f"\n\nReference Codebase: {github_link}"
    
    temperature = session.get('temperature', 0.7)
    history = session.get('history', [])
    
    messages = [
        {"role": "system", "content": system_prompt},
        *history,
        {"role": "user", "content": user_msg + file_content}
    ]
    
    try:
        resp = requests.post(
            "https://api.deepseek.com/v1/chat/completions",
            json={
                "model": "deepseek-chat", 
                "messages": messages,
                "temperature": temperature
            },
            headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
            timeout=60
        )
        resp.raise_for_status()
        reply = resp.json()['choices'][0]['message']['content']
        
        history.append({"role": "user", "content": user_msg + file_content})
        history.append({"role": "assistant", "content": reply})
        session['history'] = history
        session.modified = True
        
        return jsonify({'response': reply})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/clear', methods=['POST'])
def clear():
    session.pop('history', None)
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8501, debug=False)
