"""
清记 (CleanNotes) Desktop Launcher
Uses pywebview to create a native window for the Vue frontend.
No cargo.exe required.
"""
import os
import sys
import webview
from bottle import Bottle, static_file, response

# Resolve the web directory
# Priority: web/ (installed) > dist/ (development)
base_dir = os.path.dirname(os.path.abspath(__file__))
if os.path.isdir(os.path.join(base_dir, 'web')):
    WEB_DIR = os.path.join(base_dir, 'web')
elif os.path.isdir(os.path.join(base_dir, 'dist')):
    WEB_DIR = os.path.join(base_dir, 'dist')
else:
    WEB_DIR = os.path.join(base_dir, 'web')

app = Bottle()

@app.route('/')
def index():
    return static_file('index.html', root=WEB_DIR)

@app.route('/<filepath:path>')
def static_files(filepath):
    return static_file(filepath, root=WEB_DIR)

@app.route('/assets/<filepath:path>')
def assets(filepath):
    return static_file(filepath, root=os.path.join(WEB_DIR, 'assets'))


class Api:
    """Native API exposed to the frontend via pywebview."""
    
    def minimize(self):
        webview.windows[0].minimize()

    def maximize(self):
        webview.windows[0].toggle_fullscreen()

    def close(self):
        webview.windows[0].destroy()

    def get_version(self):
        return '0.1.0'


def main():
    icon_path = os.path.join(base_dir, '清记.ico')
    if not os.path.exists(icon_path):
        icon_path = os.path.join(base_dir, 'icon.ico')

    api = Api()

    # Create the main window
    window = webview.create_window(
        title='清记',
        url=app,
        width=1200,
        height=800,
        min_size=(800, 600),
        resizable=True,
        text_select=True,
        js_api=api,
        icon=icon_path if os.path.exists(icon_path) else None,
    )

    # Start the webview event loop
    webview.start(
        debug=False,
        http_server=True,
    )


if __name__ == '__main__':
    main()
