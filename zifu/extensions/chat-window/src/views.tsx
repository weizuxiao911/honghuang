const React = require('React');

// 直接使用 opencode web UI 作为对话面板
// opencode 自带的 web 输入框、消息流、会话管理、标题更新全部由它自己处理
const OPENCODE_WEB_URL = 'http://df-dev.localhost';

const ChatWindow = () => {
  return React.createElement('iframe', {
    src: OPENCODE_WEB_URL,
    style: {
      width: '100%',
      height: '100%',
      border: 'none',
      background: '#fff',
    },
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
    allow: 'clipboard-read; clipboard-write',
  });
};

exports['zifu.chatWindow'] = ChatWindow;