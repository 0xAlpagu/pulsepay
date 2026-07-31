let provider;
let signer;
let contract;
let myAddress = null;

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
        if (walletAddress) walletAddress.textContent = myAddress;

        const network = await provider.getNetwork();
        if (networkName) networkName.textContent = describeNetwork(network.chainId) + " (" + network.chainId + ")";

        contract = new ethers.Contract(contractAddress, contractABI, signer);
        connectBtn.textContent = "Connected: " + shortenAddress(myAddress);
        connectBtn.classList.add("connected");

        if (typeof onWalletConnected === "function") onWalletConnected();
    } catch (err) {
        console.error(err);
        if (typeof onWalletError === "function") onWalletError();
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

connectBtn.addEventListener("click", connectWallet);
autoConnectIfAuthorized();
