const streamList = document.getElementById("streamList");

function formatTimeLeft(totalSeconds) {
    if (totalSeconds <= 0) return "Fully unlocked";
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);

    const parts = [];
    if (days > 0) parts.push(days + "d");
    if (days > 0 || hours > 0) parts.push(hours + "h");
    if (days > 0 || hours > 0 || minutes > 0) parts.push(minutes + "m");
    parts.push(seconds + "s");

    return parts.join(" ") + " left";
}

function tickTimeLeftLabels() {
    const now = Math.floor(Date.now() / 1000);
    document.querySelectorAll(".time-left").forEach(el => {
        const state = el.dataset.state;

        if (state === "paused") {
            el.textContent = "Paused";
            return;
        }
        if (state === "inactive") {
            el.textContent = "Completed";
            return;
        }

        const end = Number(el.dataset.end);
        el.textContent = formatTimeLeft(end - now);
    });
}

setInterval(tickTimeLeftLabels, 1000);

async function pauseStream(id) {
    try {
        const tx = await contract.pauseStream(id);
        await tx.wait();
        loadStreams();
    } catch (err) {
        console.error(err);
    }
}

async function resumeStream(id) {
    try {
        const tx = await contract.resumeStream(id);
        await tx.wait();
        loadStreams();
    } catch (err) {
        console.error(err);
    }
}

async function withdrawStream(id) {
    try {
        const tx = await contract.withdraw(id);
        await tx.wait();
        loadStreams();
        if (typeof refreshBalance === "function") refreshBalance();
    } catch (err) {
        console.error(err);
    }
}

function clearStreamList(message) {
    if (streamList) streamList.innerHTML = `<p class="empty">${message}</p>`;
}

async function loadStreams() {
    if (!contract || !streamList) return;
    streamList.innerHTML = "";
    const count = await contract.getStreamCount();

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

        const endTime = Number(startTime) + Number(streamDuration);
        let timeState = "active";
        if (!active) timeState = "inactive";
        else if (paused) timeState = "paused";

        const card = document.createElement("div");
        card.className = "stream-card";
        card.innerHTML = `
            <span class="role-tag ${isRecipient ? "receiving" : "sending"}">
                ${isRecipient ? "Receiving" : "Sending"}${paused && active ? " &middot; Paused" : ""}
            </span>
            <p class="address-line">From: <span class="mono">${sender}</span></p>
            <p class="address-line">To: <span class="mono">${streamRecipient}</span></p>
            <p class="amount-line">${unlockedEth.toFixed(8)} / ${total.toFixed(8)} ETH</p>
            <p class="time-left" data-end="${endTime}" data-state="${timeState}"></p>
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

    tickTimeLeftLabels();
}
