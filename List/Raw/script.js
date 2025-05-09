const video = document.getElementById('video');
const channelContainer = document.getElementById('channel-list');
const searchBar = document.getElementById('search-bar');
const overlay = document.getElementById('overlay');
const buffering = document.getElementById('buffering');
const errorMessage = document.getElementById('error-message');
const defaultGif = document.getElementById('default-gif');

let channels = []; // খালি অ্যারে, fetch দিয়ে পূর্ণ হবে
let currentChannel = null;
let loadTimeout = null;
let eventListeners = []; // Store event listeners for cleanup

// গিটহাব থেকে channels.json ফেচ করা
async function loadChannels() {
  try {
    const response = await fetch('https://raw.githubusercontent.com/mdnazmul582378/Channel/refs/heads/main/List/Raw/channels.json');
    if (!response.ok) throw new Error('Failed to load channels');
    channels = await response.json();
    filterChannels(); // ডিফল্ট ফিল্টার দিয়ে রেন্ডার করা
  } catch (error) {
    console.error('Error loading channels:', error);
    showOverlay(true); // এরর মেসেজ দেখানো
    errorMessage.textContent = 'Failed to load channel list. Please try again later.';
  }
}

function showOverlay(isError = false) {
  overlay.style.display = 'flex';
  overlay.classList.add('show');
  buffering.style.display = isError ? 'none' : 'block';
  errorMessage.style.display = isError ? 'block' : 'none';
}

function hideOverlay() {
  overlay.classList.remove('show');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 300); // Match transition duration (0.3s)
  buffering.style.display = 'none';
  errorMessage.style.display = 'none';
}

function cleanupHLS() {
  if (window.hls) {
    window.hls.destroy();
    window.hls = null;
  }
  video.src = ''; // Clear video source
  video.pause();
}

function removeEventListeners() {
  eventListeners.forEach(({ event, handler }) => {
    video.removeEventListener(event, handler);
  });
  eventListeners = [];
}

function retryCurrentChannel() {
  if (currentChannel) {
    const channel = channels.find(ch => ch.name === currentChannel.textContent.trim());
    if (channel) {
      playStream(channel.url, currentChannel);
    }
  }
}

function playStream(url, channelDiv) {
  // Reset previous state
  cleanupHLS();
  removeEventListeners();
  clearTimeout(loadTimeout);
  video.style.display = 'block';
  defaultGif.style.display = 'none';
  showOverlay();

  // Update active channel
  updateActiveChannel(channelDiv);

  // Set 15-second timeout for loading
  loadTimeout = setTimeout(() => {
    cleanupHLS();
    showOverlay(true);
  }, 15000);

  // Add event listeners for buffering and playback
  const onWaiting = () => {
    if (errorMessage.style.display !== 'block') { // Only show buffering if no error
      showOverlay(false);
    }
  };
  const onPlaying = () => {
    clearTimeout(loadTimeout);
    hideOverlay();
  };
  video.addEventListener('waiting', onWaiting);
  video.addEventListener('playing', onPlaying);
  eventListeners.push(
    { event: 'waiting', handler: onWaiting },
    { event: 'playing', handler: onPlaying }
  );

  if (Hls.isSupported()) {
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
      maxBufferLength: 60,
      maxMaxBufferLength: 120,
      liveSyncDurationCount: 3,
      startLevel: 0,
      autoStartLoad: true
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      hls.startLoad();
      video.play().then(() => {
        clearTimeout(loadTimeout);
        hideOverlay();
      }).catch((err) => {
        console.error('Playback error:', err);
        clearTimeout(loadTimeout);
        showOverlay(true);
      });
    });
    hls.on(Hls.Events.ERROR, (event, data) => {
      console.error('HLS Error:', data);
      if (data.fatal) { // Only show error for fatal issues
        clearTimeout(loadTimeout);
        cleanupHLS();
        showOverlay(true);
      }
    });
    window.hls = hls;
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = url;
    video.addEventListener('loadedmetadata', () => {
      video.play().then(() => {
        clearTimeout(loadTimeout);
        hideOverlay();
      }).catch((err) => {
        console.error('Playback error:', err);
        clearTimeout(loadTimeout);
        showOverlay(true);
      });
    }, { once: true });
  } else {
    clearTimeout(loadTimeout);
    showOverlay(true);
  }
}

function updateActiveChannel(channelDiv) {
  document.querySelectorAll('.channel').forEach((ch) => ch.classList.remove('active'));
  channelDiv.classList.add('active');
  currentChannel = channelDiv;
}

function renderChannels(filteredChannels) {
  channelContainer.innerHTML = '';
  filteredChannels.forEach((ch) => {
    const div = document.createElement('div');
    div.className = 'channel';
    div.innerHTML = `<img src="${ch.img}" alt="${ch.name}" /> ${ch.name}`;
    div.onclick = () => playStream(ch.url, div);
    channelContainer.appendChild(div);
  });
}

// Dynamic 100vh fix
function setDynamicHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
  document.body.style.height = `calc(var(--vh) * 100)`;
}

// Set the height initially
setDynamicHeight();

// Update height on resize
window.addEventListener('resize', setDynamicHeight);

// Update height on orientation change for mobile
window.addEventListener('orientationchange', setDynamicHeight);

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ফিল্টার বাটন হ্যান্ডলিং
const filterButtons = document.querySelectorAll('.filter-btn');
let currentFilter = 'live'; // ডিফল্ট ফিল্টার

function updateFilterButtons(activeButton) {
  filterButtons.forEach((btn) => btn.classList.remove('active'));
  activeButton.classList.add('active');
}

function filterChannels(query = '', type = currentFilter) {
  const filteredChannels = channels.filter(
    (ch) =>
      ch.name.toLowerCase().includes(query.toLowerCase()) && ch.type === type
  );
  renderChannels(filteredChannels);
}

// বাটন ক্লিক ইভেন্ট
filterButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    currentFilter = btn.dataset.type;
    updateFilterButtons(btn);
    filterChannels(searchBar.value, currentFilter);
  });
});

// সার্চ বারের ইনপুট হ্যান্ডলিং
searchBar.addEventListener(
  'input',
  debounce(() => {
    filterChannels(searchBar.value, currentFilter);
  }, 300)
);

// পেজ লোড হওয়ার সাথে সাথে channels লোড করা
loadChannels();

// Load Google Fonts
const link = document.createElement('link');
link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&family=Roboto+Mono:wght@400&display=swap';
link.rel = 'stylesheet';
document.head.appendChild(link);
