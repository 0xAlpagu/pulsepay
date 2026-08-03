const streamCountEl = document.getElementById("streamCount");

function onWalletConnected() {
    refreshStreamCount();
}

function onWalletDisconnected() {
    if (streamCountEl) streamCountEl.textContent = "0";
}

function onWalletError() {}

async function refreshStreamCount() {
    if (!contract) return;
    try {
        const count = await contract.getStreamCount();
        streamCountEl.textContent = count;
    } catch (err) {
        console.error(err);
    }
}
