import os
import json
import requests
from flask import Flask, render_template_string, request, session, jsonify

app = Flask(__name__)
app.secret_key = os.urandom(24)
API_KEY = os.getenv("DEEPSEEK_API_KEY")
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
ALLOWED_EXTENSIONS = {'txt', 'md', 'py', 'json', 'js', 'html', 'css'}

HTML_TEMPLATE = r"""
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
        :root { --bg: #1e1e1e; --user-msg: #3b82f6; --ai-msg: #3d3d3d; --text: #e0e0e0; --input-bg: #252525; --bracket: #ff6b6b; }
        body { margin: 0; font-family: system-ui, sans-serif; background: var(--bg); color: var(--text); display: flex; flex-direction: column; height: 100vh; }
        #header { padding: 10px 15px; background: var(--input-bg); border-bottom: 1px solid #444; display: flex; justify-content: space-between; align-items: center; }
        #header h1 { margin: 0; font-size: 1.2rem; }
        #settings-btn { background: none; border: 1px solid #555; color: var(--text); padding: 5px 10px; border-radius: 4px; cursor: pointer; }
        #chat-container { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 15px; }
        .message { max-width: 85%; padding: 12px 16px; border-radius: 12px; line-height: 1.5; position: relative; }
        .user { align-self: flex-end; background: var(--user-msg); color: white; }
        .assistant { align-self: flex-start; background: var(--ai-msg); }
        .message-actions { display: flex; gap: 5px; justify-content: flex-end; margin-top: 8px; opacity: 0.7; }
        .message-actions button { background: none; border: none; color: inherit; cursor: pointer; font-size: 0.75rem; padding: 2px 6px; border-radius: 3px; }
        .message pre { background: #111; padding: 10px; border-radius: 6px; overflow-x: auto; margin: 10px 0; position: relative; }
        .message code { font-family: Consolas, monospace; font-size: 0.9em; }
        .copy-code-btn { position: absolute; top: 5px; right: 5px; background: #444; color: #fff; border: none; padding: 3px 8px; border-radius: 4px; cursor: pointer; font-size: 0.75em; }
        .bracket-text { color: var(--bracket); font-weight: bold; }
        #input-area { padding: 15px; background: var(--input-bg); border-top: 1px solid #444; display: flex; flex-direction: column; gap: 10px; }
        #file-info { font-size: 0.85rem; color: #aaa; }
        #prompt-input { width: 100%; padding: 12px; background: #333; border: 1px solid #555; color: white; border-radius: 8px; resize: none; height: 60px; box-sizing: border-box; }
        #send-btn { padding: 12px 20px; background: var(--user-msg); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; align-self: flex-end; }
        #send-btn:disabled { background: #555; cursor: not-allowed; }
        .modal { display: none; position: fixed; z-index: 100; left: 0; top: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); }
        .modal-content { background: var(--input-bg); margin: 20% auto; padding: 20px; border: 1px solid #444; width: 90%; max-width: 450px; border-radius: 8px; }
        .modal-header { display: flex; justify-content: space-between; margin-bottom: 15px; }
        .close { color: #aaa; font-size: 24px; cursor: pointer; }
        .form-group { margin-bottom: 12px; }
        .form-group label { display: block; margin-bottom: 5px; color: #ccc; font-size: 0.9rem; }
        .form-group input, .form-group textarea { width: 100%; padding: 8px; background: #333; border: 1px solid #555; color: white; border-radius: 4px; box-sizing: border-box; }
        .btn { background: var(--user-msg); color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer; width: 100%; }
        .btn-danger { background: #d32f2f; margin-top: 10px; }
    </style>
</head>
<body>
    <div id="header">
        <h1>DeepSeek</h1>
        <button id="settings-btn" onclick="openSettings()">⚙️</button>
    </div>
    <div id="chat-container"></div>
    <div id="input-area">
        <div id="file-info">
            <input type="file" id="file-input" style="display:none" multiple onchange="handleFiles(this.files)">
            <button onclick="document.getElementById('file-input').click()" style="background:#444;color:white;border:none;padding:4px 8px;border-radius:4px;cursor:pointer;font-size:0.85rem;">📎 Attach</button>
            <span id="file-names"></span>
        </div>
        <textarea id="prompt-input" placeholder="Message... (Ctrl+Enter = send)"></textarea>
        <button id="send-btn" onclick="send()">Send</button>
    </div>
    <div id="settings-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2>Settings</h2>
                <span class="close" onclick="closeSettings()">&times;</span>
            </div>
            <div class="form-group">
                <label>System Prompt</label>
                <textarea id="set-system" rows="3"></textarea>
            </div>
            <div class="form-group">
                <label>Temperature (0-1)</label>
                <input type="number" id="set-temp" step="0.1" min="0" max="1" value="0.7">
            </div>
            <div class="form-group">
                <label>GitHub Repo</label>
                <input type="text" id="set-gh" placeholder="https://github.com/user/repo">
            </div>
            <button class="btn" onclick="saveSettings()">Save</button>
            <button class="btn btn-danger" onclick="clearChat()">Clear History</button>
        </div>
    </div>
    <script>
        const chat = document.getElementById('chat-container');
        const input = document.getElementById('prompt-input');
        const sendBtn = document.getElementById('send-btn');
        const fileNames = document.getElementById('file-names');
        let files = [];
        let currentAssistantMsg = null;

        window.onload = async () => {
            const r = await fetch('/get_settings');
            const d = await r.json();
            document.getElementById('set-system').value = d.system_prompt || '';
            document.getElementById('set-temp').value = d.temperature || 0.7;
            document.getElementById('set-gh').value = d.github_link || '';
            loadHistory();
        };

        function openSettings() { document.getElementById('settings-modal').style.display = 'block'; }
        function closeSettings() { document.getElementById('settings-modal').style.display = 'none'; }

        async function saveSettings() {
            await fetch('/save_settings', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    system_prompt: document.getElementById('set-system').value,
                    temperature: parseFloat(document.getElementById('set-temp').value),
                    github_link: document.getElementById('set-gh').value
                })
            });
            closeSettings();
        }

        function handleFiles(f) {
            files = Array.from(f);
            fileNames.textContent = files.map(x => x.name).join(', ');
        }

        function highlightBrackets(html) {
            return html.replace(/(\[.*?\])/g, '<span class="bracket-text">$1</span>');
        }

        function addMessage(role, text, isStream = false) {
            if (isStream && role === 'assistant') {
                if (!currentAssistantMsg) {
                    currentAssistantMsg = document.createElement('div');
                    currentAssistantMsg.className = 'message assistant';
                    chat.appendChild(currentAssistantMsg);
                }
                const processed = highlightBrackets(marked.parse(text));
                currentAssistantMsg.innerHTML = processed;
                addActions(currentAssistantMsg, text);
                chat.scrollTop = chat.scrollHeight;
                return currentAssistantMsg;
            }

            const div = document.createElement('div');
            div.className = `message ${role}`;
            
            if (role === 'assistant') {
                const processed = highlightBrackets(marked.parse(text));
                div.innerHTML = processed;
            } else {
                div.textContent = text;
            }

            addActions(div, text);
            chat.appendChild(div);
            chat.scrollTop = chat.scrollHeight;
            return div;
        }

        function addActions(div, text) {
            let actions = div.querySelector('.message-actions');
            if (!actions) {
                actions = document.createElement('div');
                actions.className = 'message-actions';
                
                const copy = document.createElement('button');
                copy.textContent = 'Copy';
                copy.onclick = () => {
                    navigator.clipboard.writeText(text);
                    copy.textContent = 'Copied!';
                    setTimeout(() => copy.textContent = 'Copy', 1500);
                };

                const share = document.createElement('button');
                share.textContent = 'Share';
                share.onclick = async () => {
                    if (navigator.share) {
                        await navigator.share({ text });
                    } else {
                        navigator.clipboard.writeText(text);
                        share.textContent = 'Copied!';
                        setTimeout(() => share.textContent = 'Share', 1500);
                    }
                };

                actions.appendChild(copy);
                actions.appendChild(share);
                div.appendChild(actions);
            }

            div.querySelectorAll('pre code').forEach(code => {
                hljs.highlightElement(code);
                const pre = code.parentElement;
                if (!pre.querySelector('.copy-code-btn')) {
                    const btn = document.createElement('button');
                    btn.className = 'copy-code-btn';
                    btn.textContent = 'Copy';
                    btn.onclick = () => {
                        navigator.clipboard.writeText(code.textContent);
                        btn.textContent = 'Copied!';
                        setTimeout(() => btn.textContent = 'Copy', 1500);
                    };
                    pre.appendChild(btn);
                }
            });
        }

        async function loadHistory() {
            const r = await fetch('/get_history');
            const d = await r.json();
            chat.innerHTML = '';
            currentAssistantMsg = null;
            d.forEach(m => addMessage(m.role, m.content));
        }

        async function send() {
            const text = input.value.trim();
            if (!text && files.length === 0) return;

            const fd = new FormData();
            fd.append('message', text);
            files.forEach(f => fd.append('files', f));

            const display = text + (files.length ? `[${files.map(f=>f.name).join(', ')}]` : '');
            addMessage('user', display);

            input.value = '';
            files = [];
            fileNames.textContent = '';
            document.getElementById('file-input').value = '';
            sendBtn.disabled = true;
            sendBtn.textContent = '...';
            currentAssistantMsg = null;

            try {
                const r = await fetch('/chat', { method: 'POST', body: fd });
                const reader = r.body.getReader();
                const decoder = new TextDecoder();
                let fullText = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value);
                    fullText += chunk;
                    addMessage('assistant', fullText, true);
                }

                await fetch('/save_history', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ user: display, assistant: fullText })
                });
            } catch (e) {
                addMessage('assistant', `Error: ${e.message}`);
            } finally {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send';
                currentAssistantMsg = null;
            }
        }

        async function clearChat() {
            await fetch('/clear', { method: 'POST' });
            chat.innerHTML = '';
            currentAssistantMsg = null;
            closeSettings();
        }

        input.addEventListener('keydown', e => {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                send();
            }
        });
    </script>
</body>
</html>
"""

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def secure_filename(name):
    return ''.join(c for c in name if c.isalnum() or c in '._-').lstrip('.')

def get_github_context(url):
    try:
        if 'github.com' not in url: return ''
        parts = url.rstrip('/').split('/')
        if len(parts) < 2: return ''
        owner, repo = parts[-2], parts[-1]
        for branch in ['main', 'master']:
            r = requests.get(f'https://raw.githubusercontent.com/{owner}/{repo}/{branch}/README.md')
            if r.status_code == 200:
                return f'\n[Repo README]:\n{r.text[:2000]}'
    except: pass
    return ''

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
    d = request.json
    session['system_prompt'] = d.get('system_prompt', 'You are a helpful assistant.')
    session['temperature'] = d.get('temperature', 0.7)
    session['github_link'] = d.get('github_link', '')
    return jsonify({'status': 'ok'})

@app.route('/get_history')
def get_history():
    return jsonify(session.get('history', []))

@app.route('/save_history', methods=['POST'])
def save_history():
    d = request.json
    history = session.get('history', [])
    history.append({'role': 'user', 'content': d.get('user', '')})
    history.append({'role': 'assistant', 'content': d.get('assistant', '')})
    session['history'] = history
    return jsonify({'status': 'ok'})

@app.route('/chat', methods=['POST'])
def chat():
    if not API_KEY:
        return jsonify({'error': 'API Key missing'}), 500

    msg = request.form.get('message', '')
    files = request.files.getlist('files')
    file_text = ''

    for f in files:
        if f and f.filename and allowed_file(f.filename):
            fn = secure_filename(f.filename)
            path = os.path.join(UPLOAD_FOLDER, fn)
            f.save(path)
            try:
                with open(path, 'r', encoding='utf-8', errors='ignore') as fh:
                    file_text += f'\n[File: {fn}]:\n{fh.read()[:5000]}'
            except: pass

    sys_prompt = session.get('system_prompt', 'You are a helpful assistant.')
    gh = session.get('github_link', '')
    temp = session.get('temperature', 0.7)  # Capture BEFORE generator
    if gh:
        sys_prompt += get_github_context(gh)

    history = session.get('history', [])
    messages = [
        {'role': 'system', 'content': sys_prompt},
        *history,
        {'role': 'user', 'content': msg + file_text}
    ]

    def generate():
        try:
            resp = requests.post(
                'https://api.deepseek.com/v1/chat/completions',
                json={'model': 'deepseek-chat', 'messages': messages, 'temperature': temp, 'stream': True},
                headers={'Authorization': f'Bearer {API_KEY}', 'Content-Type': 'application/json'},
                stream=True
            )
            for line in resp.iter_lines():
                if line:
                    decoded = line.decode('utf-8')
                    if decoded.startswith('data: '):
                        data = decoded[6:]
                        if data.strip() == '[DONE]':
                            break
                        try:
                            chunk = json.loads(data)
                            content = chunk['choices'][0]['delta'].get('content', '')
                            if content:
                                yield content
                        except: pass
        except Exception as e:
            yield f'Error: {str(e)}'

    return app.response_class(generate(), mimetype='text/plain')

@app.route('/clear', methods=['POST'])
def clear():
    session.pop('history', None)
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8501, debug=False)
