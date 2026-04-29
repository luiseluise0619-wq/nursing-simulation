const { app, BrowserWindow } = require('electron')

function createWindow() {
    const win = new BrowserWindow({
        width: 450, // 모바일 시뮬레이터에 맞는 폭
        height: 800
    })

    // 우리가 만든 index.html 파일을 로드합니다.
    win.loadFile('index.html')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})