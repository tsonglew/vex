import * as vscode from 'vscode';

export class VectorWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'vex.vectorsView';
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'ready':
                    // Webview is ready
                    break;
            }
        });
    }

    public updateVectors(vectors: any[], collectionName: string) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateVectors',
                vectors: vectors,
                collectionName: collectionName
            });
        }
    }

    public clearVectors() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'clearVectors'
            });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vectors.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vectors.css'));

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>Vectors</title>
        </head>
        <body>
            <div class="header">
                <h1>Vectors</h1>
                <div class="collection-info">
                    <span id="collection-name">No collection selected</span>
                    <span id="vector-count">0 vectors</span>
                </div>
            </div>
            
            <div class="controls">
                <button id="refresh-btn" class="btn">Refresh</button>
                <button id="clear-btn" class="btn">Clear</button>
            </div>

            <div class="search-container">
                <input type="text" id="search-input" placeholder="Search vectors..." class="search-input">
                <button id="search-btn" class="btn">Search</button>
            </div>

            <div id="vectors-container" class="vectors-container">
                <div class="empty-state">
                    <p>No vectors to display</p>
                    <p>Select a collection to view vectors</p>
                </div>
            </div>

            <script src="${scriptUri}"></script>
        </body>
        </html>`;
    }
}