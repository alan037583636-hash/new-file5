(() => {
  "use strict";

  const NODES = ["A", "B", "C", "D", "E", "F"];
  const POSITIONS = {
    A: { x: 180, y: 270, tag: "起點", tagClass: "start-tag" },
    B: { x: 380, y: 120 },
    C: { x: 380, y: 432 },
    D: { x: 590, y: 120 },
    E: { x: 590, y: 432 },
    F: { x: 790, y: 270, tag: "終點", tagClass: "end-tag" }
  };
  const EDGES = [
    { id: "A-B", a: "A", b: "B", weight: 2 },
    { id: "A-C", a: "A", b: "C", weight: 5 },
    { id: "B-C", a: "B", b: "C", weight: 1 },
    { id: "B-D", a: "B", b: "D", weight: 4 },
    { id: "C-E", a: "C", b: "E", weight: 2 },
    { id: "D-E", a: "D", b: "E", weight: 1 },
    { id: "D-F", a: "D", b: "F", weight: 3 },
    { id: "E-F", a: "E", b: "F", weight: 6 }
  ];

  const elements = {
    edgeLayer: document.querySelector("#edge-layer"),
    weightLayer: document.querySelector("#weight-layer"),
    nodeLayer: document.querySelector("#node-layer"),
    queueList: document.querySelector("#queue-list"),
    queueEmpty: document.querySelector("#queue-empty"),
    table: document.querySelector("#distance-table"),
    stepLog: document.querySelector("#step-log"),
    stepBadge: document.querySelector("#step-badge"),
    stepNumber: document.querySelector("#step-number"),
    stepTitle: document.querySelector("#step-title"),
    stepDescription: document.querySelector("#step-description"),
    slider: document.querySelector("#step-slider"),
    counter: document.querySelector("#step-counter"),
    prev: document.querySelector("#prev-button"),
    next: document.querySelector("#next-button"),
    play: document.querySelector("#play-button"),
    reset: document.querySelector("#reset-button"),
    pops: document.querySelector("#stat-pops"),
    skips: document.querySelector("#stat-skips"),
    relaxes: document.querySelector("#stat-relaxes"),
    finalized: document.querySelector("#stat-finalized"),
    finalizedCount: document.querySelector("#finalized-count"),
    resultSummary: document.querySelector("#result-summary")
  };

  const adjacency = Object.fromEntries(NODES.map((node) => [node, []]));
  EDGES.forEach((edge) => {
    adjacency[edge.a].push({ node: edge.b, weight: edge.weight, edgeId: edge.id });
    adjacency[edge.b].push({ node: edge.a, weight: edge.weight, edgeId: edge.id });
  });

  let steps = [];
  let currentStep = 0;
  let playTimer = null;
  let queueSequence = 0;

  function makeInitialState() {
    return {
      dist: Object.fromEntries(NODES.map((node) => [node, Infinity])),
      parent: Object.fromEntries(NODES.map((node) => [node, null])),
      status: Object.fromEntries(NODES.map((node) => [node, "unvisited"])),
      queue: [],
      activeEdge: null,
      expandedNode: null,
      finalized: [],
      counts: { pops: 0, skips: 0, relaxes: 0, finalized: 0 },
      routeEdges: [],
      treeEdges: []
    };
  }

  function copyState(state) {
    return {
      dist: { ...state.dist },
      parent: { ...state.parent },
      status: { ...state.status },
      queue: state.queue.map((entry) => ({ ...entry })),
      activeEdge: state.activeEdge,
      expandedNode: state.expandedNode,
      finalized: [...state.finalized],
      counts: { ...state.counts },
      routeEdges: [...state.routeEdges],
      treeEdges: [...state.treeEdges]
    };
  }

  function addStep(state, type, title, description, details = {}) {
    steps.push({
      type,
      title,
      description,
      node: details.node || null,
      edgeId: details.edgeId || null,
      state: copyState(state)
    });
  }

  function sortQueue(queue) {
    queue.sort((left, right) => left.distance - right.distance || left.order - right.order);
  }

  function recordAlgorithm() {
    steps = [];
    queueSequence = 0;
    const state = makeInitialState();
    state.dist.A = 0;
    state.queue.push({ distance: 0, node: "A", order: queueSequence++ });
    state.status.A = "queued";
    addStep(state, "START", "派遣從 A 開始", "初始化 dist[A] = 0，其餘節點為 ∞；將 (0, A) 放入優先佇列。");

    while (state.queue.length > 0) {
      sortQueue(state.queue);
      const entry = state.queue.shift();
      const { distance, node } = entry;
      state.expandedNode = null;
      state.activeEdge = null;

      if (distance > state.dist[node]) {
        state.counts.pops += 1;
        state.counts.skips += 1;
        addStep(
          state,
          "SKIP",
          `過期條目 (${distance}, ${node})，直接跳過`,
          `目前 dist[${node}] = ${state.dist[node]}，比佇列條目的 ${distance} 更短；這是較舊的距離紀錄，不必重新展開。`,
          { node }
        );
        continue;
      }

      state.counts.pops += 1;
      state.expandedNode = node;
      state.status[node] = "expanding";
      addStep(
        state,
        "POP",
        `取出 (${distance}, ${node})，開始展開`,
        `它是目前距離最小的有效條目，因此先處理節點 ${node}；接著檢查它尚未出爐的鄰居。`,
        { node }
      );

      for (const neighbor of adjacency[node]) {
        if (state.finalized.includes(neighbor.node)) continue;

        state.activeEdge = neighbor.edgeId;
        const candidate = distance + neighbor.weight;
        if (candidate < state.dist[neighbor.node]) {
          const previous = state.dist[neighbor.node];
          state.dist[neighbor.node] = candidate;
          state.parent[neighbor.node] = node;
          state.queue.push({ distance: candidate, node: neighbor.node, order: queueSequence++ });
          state.status[neighbor.node] = "queued";
          state.counts.relaxes += 1;
          addStep(
            state,
            "RELAX",
            `鬆弛成功：${node} → ${neighbor.node}`,
            `經過 ${node} 的距離為 ${distance} + ${neighbor.weight} = ${candidate}，嚴格小於原本的 ${previous === Infinity ? "∞" : previous}；更新 dist[${neighbor.node}]，parent 設為 ${node}，並將新條目加入佇列。`,
            { node, edgeId: neighbor.edgeId }
          );
        } else {
          const currentDistance = state.dist[neighbor.node];
          addStep(
            state,
            "RELAX",
            `檢查 ${node} → ${neighbor.node}，距離不更新`,
            `候選距離 ${distance} + ${neighbor.weight} = ${candidate}，沒有嚴格小於目前的 ${currentDistance === Infinity ? "∞" : currentDistance}，因此保留原本的 dist 與 parent。`,
            { node, edgeId: neighbor.edgeId }
          );
        }
      }

      state.activeEdge = null;
      state.expandedNode = null;
      state.status[node] = "finalized";
      state.finalized.push(node);
      state.counts.finalized += 1;
      addStep(
        state,
        "FINALIZE",
        `節點 ${node} 已出爐 (定案)`,
        `節點 ${node} 的最短距離已確定為 ${state.dist[node]}；之後不再重新展開它。`
      );
    }

    const route = [];
    let cursor = "F";
    while (cursor !== null) {
      route.unshift(cursor);
      cursor = state.parent[cursor];
    }
    const routeEdges = [];
    for (let index = 0; index < route.length - 1; index += 1) {
      routeEdges.push(edgeIdFor(route[index], route[index + 1]));
    }
    const treeEdges = NODES
      .filter((node) => state.parent[node] !== null)
      .map((node) => edgeIdFor(node, state.parent[node]));
    state.routeEdges = routeEdges;
    state.treeEdges = treeEdges.filter((edgeId) => !routeEdges.includes(edgeId));
    state.activeEdge = null;
    state.expandedNode = null;
    addStep(
      state,
      "DONE",
      "完成！到 F 最短 9",
      "佇列空了，所有到得了的點都出爐。從終點沿 parent 回溯：A → B → D → F，總長 9。綠色粗線就是這條最短路徑。"
    );
  }

  function edgeIdFor(first, second) {
    return EDGES.find((edge) =>
      (edge.a === first && edge.b === second) || (edge.a === second && edge.b === first)
    ).id;
  }

  function svgElement(tag, attributes = {}) {
    const element = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    return element;
  }

  function createMap() {
    EDGES.forEach((edge) => {
      const first = POSITIONS[edge.a];
      const second = POSITIONS[edge.b];
      const line = svgElement("line", {
        id: `edge-${edge.id}`,
        class: "edge-line",
        x1: first.x,
        y1: first.y,
        x2: second.x,
        y2: second.y
      });
      elements.edgeLayer.append(line);

      const midpoint = getWeightPosition(edge, first, second);
      const group = svgElement("g", { "aria-hidden": "true" });
      const pill = svgElement("rect", {
        class: "weight-pill",
        x: midpoint.x - 16,
        y: midpoint.y - 14,
        width: 32,
        height: 28,
        rx: 9
      });
      const text = svgElement("text", {
        class: "weight-text",
        x: midpoint.x,
        y: midpoint.y + 1
      });
      text.textContent = edge.weight;
      group.append(pill, text);
      elements.weightLayer.append(group);
    });

    NODES.forEach((node) => {
      const { x, y, tag, tagClass } = POSITIONS[node];
      const group = svgElement("g", { id: `node-${node}`, class: "node-group" });
      const distance = svgElement("text", {
        id: `dist-${node}`,
        class: "distance-label",
        x,
        y: y - 59
      });
      const circle = svgElement("circle", {
        id: `circle-${node}`,
        class: "node-circle state-unvisited",
        cx: x,
        cy: y,
        r: 34
      });
      const label = svgElement("text", {
        class: "node-label",
        x,
        y: y + 1
      });
      label.textContent = node;
      group.append(distance, circle, label);
      if (tag) {
        const tagElement = svgElement("text", {
          class: `node-tag ${tagClass}`,
          x,
          y: y + 64
        });
        tagElement.textContent = tag;
        group.append(tagElement);
      }
      elements.nodeLayer.append(group);
    });
  }

  function getWeightPosition(edge, first, second) {
    let x = (first.x + second.x) / 2;
    let y = (first.y + second.y) / 2;
    if (edge.id === "A-B") { x -= 9; y -= 13; }
    if (edge.id === "A-C") { x -= 8; y += 14; }
    if (edge.id === "B-C") { x -= 24; }
    if (edge.id === "B-D") { y -= 19; }
    if (edge.id === "C-E") { y += 17; }
    if (edge.id === "D-E") { x += 24; }
    if (edge.id === "D-F") { x += 11; y -= 14; }
    if (edge.id === "E-F") { x += 9; y += 15; }
    return { x, y };
  }

  function formatDistance(distance) {
    return Number.isFinite(distance) ? String(distance) : "∞";
  }

  function getNodeStatus(state, node) {
    if (state.status[node] === "finalized") return "finalized";
    if (state.expandedNode === node) return "expanding";
    if (state.queue.some((entry) => entry.node === node)) return "queued";
    return "unvisited";
  }

  function renderMap(state) {
    EDGES.forEach((edge) => {
      const line = document.querySelector(`#edge-${edge.id}`);
      line.setAttribute("class", "edge-line");
      if (edge.id === state.activeEdge) line.classList.add("is-relaxing");
      else if (state.routeEdges.includes(edge.id)) line.classList.add("is-path");
      else if (state.treeEdges.includes(edge.id)) line.classList.add("is-tree");
    });

    NODES.forEach((node) => {
      const circle = document.querySelector(`#circle-${node}`);
      const status = getNodeStatus(state, node);
      circle.setAttribute("class", `node-circle state-${status}`);
      document.querySelector(`#dist-${node}`).textContent = formatDistance(state.dist[node]);
    });
  }

  function renderQueue(state) {
    elements.queueList.replaceChildren();
    const queue = [...state.queue].sort((left, right) => left.distance - right.distance || left.order - right.order);
    elements.queueList.hidden = queue.length === 0;
    elements.queueEmpty.hidden = queue.length !== 0;
    queue.forEach((entry, index) => {
      const item = document.createElement("li");
      item.className = `queue-item${index === 0 ? " is-next" : ""}`;
      const tuple = document.createElement("span");
      tuple.className = "queue-tuple";
      tuple.textContent = `(${entry.distance}, ${entry.node})`;
      item.append(tuple);
      if (index === 0) {
        const nextLabel = document.createElement("span");
        nextLabel.className = "queue-next-label";
        nextLabel.textContent = "← 下一個取出";
        item.append(nextLabel);
      }
      elements.queueList.append(item);
    });
  }

  function statusLabel(status) {
    return {
      queued: "排隊中",
      unvisited: "未探索",
      expanding: "展開中",
      finalized: "已出爐"
    }[status];
  }

  function renderTable(state) {
    elements.table.replaceChildren();
    NODES.forEach((node) => {
      const status = getNodeStatus(state, node);
      const row = document.createElement("tr");
      const values = [node, formatDistance(state.dist[node]), state.parent[node] || "—"];
      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      });
      const statusCell = document.createElement("td");
      const pill = document.createElement("span");
      pill.className = `status-pill status-${status}`;
      pill.textContent = statusLabel(status);
      statusCell.append(pill);
      row.append(statusCell);
      elements.table.append(row);
    });
    elements.finalizedCount.textContent = `出爐 ${state.counts.finalized} / 6`;
    elements.resultSummary.hidden = !state.routeEdges.length;
  }

  function renderLog(step, index) {
    const kind = step.type === "DONE" ? "done" : step.type === "SKIP" ? "skip" : step.type === "RELAX" ? "relax" : "progress";
    elements.stepLog.className = `step-log kind-${kind}`;
    elements.stepBadge.textContent = step.type;
    elements.stepNumber.textContent = `STEP ${index}`;
    elements.stepTitle.textContent = step.title;
    if (step.type === "DONE") {
      const route = document.createElement("strong");
      route.textContent = "A → B → D → F";
      const distance = document.createElement("strong");
      distance.textContent = "9";
      elements.stepDescription.replaceChildren(
        document.createTextNode("佇列空了，所有到得了的點都出爐。從終點沿 parent 回溯："),
        route,
        document.createTextNode("，總長 "),
        distance,
        document.createTextNode("。綠色粗線就是這條最短路徑。")
      );
    } else {
      elements.stepDescription.textContent = step.description;
    }
  }

  function render() {
    const step = steps[currentStep];
    const state = step.state;
    renderMap(state);
    renderQueue(state);
    renderTable(state);
    renderLog(step, currentStep);
    elements.pops.textContent = state.counts.pops;
    elements.skips.textContent = state.counts.skips;
    elements.relaxes.textContent = state.counts.relaxes;
    elements.finalized.textContent = state.counts.finalized;
    elements.slider.max = String(steps.length - 1);
    elements.slider.value = String(currentStep);
    elements.counter.textContent = `${currentStep} / ${steps.length - 1}`;
    elements.prev.disabled = currentStep === 0;
    elements.next.disabled = currentStep === steps.length - 1;
    if (currentStep === steps.length - 1) stopPlayback();
  }

  function goToStep(index) {
    currentStep = Math.max(0, Math.min(steps.length - 1, index));
    render();
  }

  function stopPlayback() {
    if (playTimer !== null) {
      window.clearInterval(playTimer);
      playTimer = null;
    }
    if (elements.play) {
      elements.play.textContent = "▶ 自動播放";
      elements.play.setAttribute("aria-label", "自動播放");
    }
  }

  function togglePlayback() {
    if (playTimer !== null) {
      stopPlayback();
      return;
    }
    if (currentStep === steps.length - 1) goToStep(0);
    elements.play.textContent = "Ⅱ 暫停播放";
    elements.play.setAttribute("aria-label", "暫停播放");
    playTimer = window.setInterval(() => {
      if (currentStep >= steps.length - 1) {
        stopPlayback();
        return;
      }
      goToStep(currentStep + 1);
    }, 1000);
  }

  function isTypingTarget(target) {
    return target instanceof HTMLElement &&
      (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName));
  }

  function bindControls() {
    elements.prev.addEventListener("click", () => {
      stopPlayback();
      goToStep(currentStep - 1);
    });
    elements.next.addEventListener("click", () => {
      stopPlayback();
      goToStep(currentStep + 1);
    });
    elements.play.addEventListener("click", togglePlayback);
    elements.reset.addEventListener("click", () => {
      stopPlayback();
      goToStep(0);
    });
    elements.slider.addEventListener("input", () => {
      stopPlayback();
      goToStep(Number(elements.slider.value));
    });
    document.addEventListener("keydown", (event) => {
      if (isTypingTarget(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        stopPlayback();
        goToStep(currentStep - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        stopPlayback();
        goToStep(currentStep + 1);
      } else if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
      }
    });
  }

  createMap();
  recordAlgorithm();
  bindControls();
  render();
})();
