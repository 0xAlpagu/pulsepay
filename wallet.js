let provider;
let signer;
let contract;
let myAddress = null;
let balanceInterval = null;

const GIWA_CHAIN_ID = 91342;
const GIWA_CHAIN_ID_HEX = "0x" + GIWA_CHAIN_ID.toString(16);

const connectBtn = document.getElementById("connectWallet");
const walletAddress = document.getElementById("walletAddress");
const networkName = document.getElementById("networkName");
const contractAddressText = document.getElementById("contractAddress");

if (contractAddressText) contractAddressText.textContent = contractAddress;

async function ensureGiwaNetwork() {
    const currentChainId = await window.ethereum.request({ method: "eth_chainId" });
    if (currentChainId === GIWA_CHAIN_ID_HEX) return;

    try {
        await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: GIWA_CHAIN_ID_HEX }]
        });
    } catch (switchError) {
        if (switchError.code === 4902) {
            await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [{
                    chainId: GIWA_CHAIN_ID_HEX,
                    chainName: "GIWA Sepolia",
                    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                    rpcUrls: ["https://sepolia-rpc.giwa.io"],
                    blockExplorerUrls: ["https://sepolia-explorer.giwa.io"]
                }]
            });
        } else {
            throw switchError;
        }
    }
}

function describeNetwork(chainId) {
    if (chainId === GIWA_CHAIN_ID) return "GIWA Sepolia";
    return "Unsupported network";
}

function shortenAddress(addr) {
    return addr.slice(0, 6) + "..." + addr.slice(-4);
}

async function refreshBalance() {
    if (!provider || !myAddress || !walletAddress) return;
    try {
        const bal = await provider.getBalance(myAddress);
        const eth = Number(ethers.utils.formatEther(bal)).toFixed(4);
        walletAddress.innerHTML = shortenAddress(myAddress) + '<span class="balance-line">' + eth + ' ETH</span>';
    } catch (err) {
        console.error(err);
    }
}

async function connectWallet() {
    if (!window.ethereum) {
        alert("No EVM wallet detected. Open this page inside your wallet app's browser, or install a wallet extension.");
        return;
    }
    try {
        await ensureGiwaNetwork();
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        myAddress = await signer.getAddress();

        const network = await provider.getNetwork();
        if (networkName) networkName.textContent = describeNetwork(network.chainId) + " (" + network.chainId + ")";

        contract = new ethers.Contract(contractAddress, contractABI, signer);
        connectBtn.textContent = "Connected: " + shortenAddress(myAddress);
        connectBtn.classList.add("connected");

        await refreshBalance();
        if (balanceInterval) clearInterval(balanceInterval);
        balanceInterval = setInterval(refreshBalance, 15000);

        if (typeof onWalletConnected === "function") onWalletConnected();
    } catch (err) {
        console.error(err);
        if (typeof onWalletError === "function") onWalletError();
    }
}

async function disconnectWallet() {
    try {
        if (window.ethereum && window.ethereum.request) {
            await window.ethereum.request({
                method: "wallet_revokePermissions",
                params: [{ eth_accounts: {} }]
            });
        }
    } catch (err) {
        // Not all wallets support programmatic revoke — that's fine,
        // we still reset the site's own view of the connection below.
    }

    if (balanceInterval) {
        clearInterval(balanceInterval);
        balanceInterval = null;
    }

    provider = undefined;
    signer = undefined;
    contract = undefined;
    myAddress = null;

    if (walletAddress) walletAddress.textContent = "Not Connected";
    if (networkName) networkName.textContent = "Unknown";
    connectBtn.textContent = "Connect Wallet";
    connectBtn.classList.remove("connected");

    if (typeof onWalletDisconnected === "function") onWalletDisconnected();
}

function toggleWallet() {
    if (contract) {
        disconnectWallet();
    } else {
        connectWallet();
    }
}

async function autoConnectIfAuthorized() {
    if (!window.ethereum) return;
    try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) await connectWallet();
    } catch (err) {
        console.error(err);
    }
}

connectBtn.addEventListener("click", toggleWallet);
autoConnectIfAuthorized();

/* ---------- React to wallet-side changes ---------- */

if (window.ethereum && window.ethereum.on) {
    window.ethereum.on("accountsChanged", async (accounts) => {
        if (!contract) return; // we weren't connected on this page anyway

        if (accounts.length === 0) {
            // User disconnected all accounts from this site in their wallet.
            await disconnectWallet();
            return;
        }

        const newAddress = accounts[0];
        if (myAddress && newAddress.toLowerCase() === myAddress.toLowerCase()) return;

        // A different account is now active — reconnect cleanly to it.
        await connectWallet();
    });

    window.ethereum.on("chainChanged", () => {
        if (!contract) return; // not connected, nothing to reconcile

        // ethers v5 providers don't handle an in-place chain swap safely,
        // so the simplest reliable fix is to reload with the new chain state.
        window.location.reload();
    });
}
