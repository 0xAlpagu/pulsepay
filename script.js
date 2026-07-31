let provider;
let signer;
let contract;
let myAddress = null;

const connectBtn = document.getElementById("connectWallet");
const walletAddress = document.getElementById("walletAddress");
const networkName = document.getElementById("networkName");
const contractAddressText = document.getElementById("contractAddress");
const streamCountEl = document.getElementById("streamCount");
const recipient = document.getElementById("recipient");
const duration = document.getElementById("duration");
const amount = document.getElementById("amount");
const createStreamBtn = document.getElementById("createStream");
const streamList = document.getElementById("streamList");
const status = document.getElementById("status");
const batchRows = document.getElementById("batchRows");
const batchDuration = document.getElementById("batchDuration");
const createBatchBtn = document.getElementById("createBatch");
const batchStatus = document.getElementById("batchStatus");

contractAddressText.textContent = contractAddress;

const GIWA_CHAIN_ID = 91342;
const GIWA_CHAIN_ID_HEX = "0x" + GIWA_CHAIN_ID.toString(16);

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
        walletAddress.textContent = myAddress;

        const network = await provider.getNetwork();
        networkName.textContent = describeNetwork(network.chainId) + " (" + network.chainId + ")";

        contract = new ethers.Contract(contractAddress, contractABI, signer);
        loadStreams();
    } catch (err) {
        console.error(err);
        status.textContent = "Could not connect wallet.";
        status.classList.add("error");
    }
}

connectBtn.addEventListener("click", connectWallet);
createStreamBtn.addEventListener("click", createStream);
createBatchBtn.addEventListener("click", createBatch);

async function createStream() {
    if (!contract) return;
    try {
        status.classList.remove("error");

        if (!ethers.utils.isAddress(recipient.value)) {
            status.textContent = "Enter a valid recipient address.";
            status.classList.add("error");
            return;
        }
        if (!amount.value || Number(amount.value) <= 0) {
            status.textContent = "Enter an amount greater than 0.";
            status.classList.add("error");
            return;
        }

        status.textContent = "Sending transaction...";
        const value = ethers.utils.parseEther(amount.value);
        const tx = await contract.createStream(recipient.value, duration.value, { value });
        await tx.wait();

        status.textContent = "Stream created successfully.";
        recipient.value = "";
        amount.value = "";
        loadStreams();
    } catch (err) {
        console.error(err);
        status.textContent = "Transaction failed.";
        status.classList.add("error");
    }
}

async function createBatch() {
    if (!contract) return;
    try {
        batchStatus.classList.remove("error");

        const lines = batchRows.value.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length === 0) {
            batchStatus.textContent = "Add at least one recipient line.";
            batchStatus.classList.add("error");
            return;
        }

        const recipients = [];
        const amounts = [];
        let totalEth = 0;

        for (const line of lines) {
            const parts = line.split(",").map(p => p.trim());
            if (parts.length !== 2 || !ethers.utils.isAddress(parts[0]) || !parts[1] || Number(parts[1]) <= 0) {
                batchStatus.textContent = `Invalid line: "${line}". Use format: 0xAddress, amount`;
                batchStatus.classList.add("error");
                return;
            }
            recipients.push(parts[0]);
            amounts.push(ethers.utils.parseEther(parts[1]));
            totalEth += Number(parts[1]);
        }

        batchStatus.textContent = "Sending batch transaction...";
        const tx = await contract.createStreamBatch(recipients, amounts, batchDuration.value, {
            value: ethers.utils.parseEther(totalEth.toString())
        });
        await tx.wait();

        batchStatus.textContent = `Batch sent to ${recipients.length} recipients.`;
        batchRows.value = "";
        loadStreams();
    } catch (err) {
        console.error(err);
        batchStatus.textContent = "Batch transaction failed.";
        batchStatus.classList.add("error");
    }
}

async function pauseStream(id) {
    try {
        status.classList.remove("error");
        status.textContent = "Pausing stream...";
        const tx = await contract.pauseStream(id);
        await tx.wait();
        status.textContent = "Stream paused.";
        loadStreams();
    } catch (err) {
        console.error(err);
        status.textContent = "Could not pause stream.";
        status.classList.add("error");
    }
}

async function resumeStream(id) {
    try {
        status.classList.remove("error");
        status.textContent = "Resuming stream...";
        const tx = await contract.resumeStream(id);
        await tx.wait();
        status.textContent = "Stream resumed.";
        loadStreams();
    } catch (err) {
        console.error(err);
        status.textContent = "Could not resume stream.";
        status.classList.add("error");
    }
}

async function withdrawStream(id) {
    try {
        status.classList.remove("error");
        status.textContent = "Withdrawing...";
        const tx = await contract.withdraw(id);
        await tx.wait();
        status.textContent = "Withdrawal successful.";
        loadStreams();
    } catch (err) {
        console.error(err);
        status.textContent = "Withdrawal failed.";
        status.classList.add("error");
    }
}

async function loadStreams() {
    streamList.innerHTML = "";
    const count = await contract.getStreamCount();
    streamCountEl.textContent = count;

    if (count == 0) {
        streamList.innerHTML = "<p class='empty'>No streams yet.</p>";
        return;
    }

    let shown = 0;

    for (let i = count - 1; i >= 0; i--) {
        const s = await contract.getStream(i);
        const [sender, streamRecipient, totalAmount, startTime, streamDuration, withdrawn, active, paused] = s;

        const isSender = myAddress && sender.toLowerCase() === myAddress.toLowerCase();
        const isRecipient = myAddress && streamRecipient.toLowerCase() === myAddress.toLowerCase();
        if (!isSender && !isRecipient) continue;

        const unlocked = await contract.unlockedAmount(i);
        const total = Number(ethers.utils.formatEther(totalAmount));
        const unlockedEth = Number(ethers.utils.formatEther(unlocked.add(withdrawn)));
        const percent = total > 0 ? Math.min(100, (unlockedEth / total) * 100) : 100;

        const card = document.createElement("div");
        card.className = "stream-card";
        card.innerHTML = `
            <span class="role-tag ${isRecipient ? "receiving" : "sending"}">
                ${isRecipient ? "Receiving" : "Sending"}${paused && active ? " &middot; Paused" : ""}
            </span>
            <p class="address-line">From: <span class="mono">${sender}</span></p>
            <p class="address-line">To: <span class="mono">${streamRecipient}</span></p>
            <p class="amount-line">${unlockedEth.toFixed(5)} / ${total.toFixed(5)} ETH</p>
            <div class="progress-track">
                <div class="progress-fill" style="width:${percent}%"></div>
            </div>
            <div class="card-actions"></div>
        `;

        const actions = card.querySelector(".card-actions");

        if (isRecipient) {
            const withdrawBtn = document.createElement("button");
            withdrawBtn.textContent = active ? "Withdraw available" : "Fully withdrawn";
            withdrawBtn.disabled = !active || Number(ethers.utils.formatEther(unlocked)) <= 0;
            withdrawBtn.addEventListener("click", () => withdrawStream(i));
            actions.appendChild(withdrawBtn);
        }

        if (isSender && active) {
            const toggleBtn = document.createElement("button");
            toggleBtn.className = "secondary-btn";
            toggleBtn.textContent = paused ? "Resume stream" : "Pause stream";
            toggleBtn.addEventListener("click", () => (paused ? resumeStream(i) : pauseStream(i)));
            actions.appendChild(toggleBtn);
        }

        streamList.appendChild(card);
        shown++;
    }

    if (shown === 0) {
        streamList.innerHTML = "<p class='empty'>No streams yet.</p>";
    }
}
