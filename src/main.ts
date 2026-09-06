import './style.css';
import { calculateStats } from './features';
import { parseTakeoutZip } from './parsers';
import type { RecapStats } from './types';

const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('앱 루트를 찾을 수 없습니다.');

app.innerHTML = `
  <main class="shell">
    <section class="intro">
      <p class="kicker">YOUR PERSONAL YOUTUBE</p>
      <h1>YouTube<br><em>Me</em></h1>
      <p class="lede">당신은 YouTube를<br>어떻게 보고 있을까요?</p>
      <div class="privacy"><span></span> 원본 파일은 이 브라우저 안에서만 분석됩니다</div>
      <button id="theme-toggle" class="theme-toggle" type="button" aria-label="테마 전환"><span>☼</span> 라이트</button>
    </section>
    <section class="workspace">
      <div class="upload-grid single-upload">
        <label class="upload-card primary" for="zip-file">
          <span class="upload-index">01</span>
          <strong>Google Takeout 가져오기</strong>
          <small>시청 기록과 검색 기록을 ZIP 안에서 자동으로 찾습니다</small>
          <input id="zip-file" type="file" accept=".zip,application/zip" />
          <span class="choose">파일 선택 <b>↗</b></span>
        </label>
      </div>
      <ol class="takeout-steps" aria-label="Google Takeout 가져오기 단계">
        <li><b>1</b><span><a href="https://takeout.google.com/" target="_blank" rel="noreferrer">Google Takeout 열기 ↗</a></span></li>
        <li><b>2</b><span>YouTube 및 YouTube Music 선택</span></li>
        <li><b>3</b><span>기록 포함 확인 후 ZIP 다운로드</span></li>
        <li><b>4</b><span>이곳에 ZIP 가져오기</span></li>
      </ol>
      <p class="takeout-help">Google Takeout에서 <strong>YouTube 및 YouTube Music</strong>만 선택한 뒤, 데이터 형식은 JSON으로 둡니다. 다운로드한 ZIP을 풀지 말고 그대로 가져오면 YouTube Me가 시청 기록, 검색 기록, 구독 목록을 자동으로 찾습니다.</p>
      <p id="status" class="status">시청 기록 파일을 올리면 리캡이 시작됩니다.</p>
      <section id="result" class="result" hidden></section>
    </section>
  </main>
`;

let watchStats: RecapStats | null = null;
let searchLabel = '';
const status = document.querySelector<HTMLParagraphElement>('#status');
const result = document.querySelector<HTMLElement>('#result');

function formatDate(date: Date | null): string {
  return date ? new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(date) : '날짜 없음';
}

function formatRange(start: Date | null, end: Date | null): string {
  if (!start || !end) return '데이터 없음';
  return `${formatDate(start)} — ${formatDate(end)}`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}분`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes ? `${hours}시간 ${remainingMinutes}분` : `${hours}시간`;
}

function renderRhythm(stats: RecapStats, className = ''): string {
  const maximum = Math.max(...stats.rhythm.map((cell) => cell.count), 0);
  if (!maximum) return '<p class="empty-detail">시청 리듬을 계산할 영상 기록이 없습니다.</p>';
  return `<div class="rhythm-layout ${className}"><div class="rhythm-days" aria-hidden="true"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div><div class="rhythm-grid" role="img" aria-label="요일과 시간대별 시청 기록 분포">${stats.rhythm.map((cell) => {
    const intensity = cell.count ? Math.max(16, Math.round((cell.count / maximum) * 100)) : 0;
    return `<span class="rhythm-cell" style="--intensity:${intensity}%" title="${dayNames[cell.day]} ${cell.hour}시: ${cell.count}개"></span>`;
  }).join('')}<div class="rhythm-hours"><span>0시</span><span>6시</span><span>12시</span><span>18시</span><span>24시</span></div></div></div>`;
}

function renderCoverageMessage(stats: RecapStats): string {
  const messages: string[] = [];
  if (!stats.coverage.hasSearchData) {
    messages.push('검색 기록이 없어 장기 탐색 성향은 계산하지 않았습니다.');
  } else if (stats.coverage.searchDays > stats.coverage.watchDays * 2) {
    messages.push('검색은 장기간의 탐색 기록이고, 시청 통계는 최근 기록 중심입니다.');
  }
  if (stats.coverage.watchChannelCoverage < 0.9) {
    messages.push('일부 시청 기록에는 채널 정보가 없어 채널 지표에서 제외될 수 있습니다.');
  }
  return messages.length ? `<p class="coverage-message">${messages.map(escapeHtml).join('<br>')}</p>` : '';
}

function renderBehaviorRadarSvg(profile: NonNullable<RecapStats['behaviorProfile']>, className = 'behavior-radar'): string {
  const centerX = 160;
  const centerY = 136;
  const radius = 92;
  const point = (score: number, index: number, scale = 1): string => {
    const angle = (Math.PI * 2 * index) / profile.scores.length - Math.PI / 2;
    const distance = radius * scale * (score / 100);
    return `${(centerX + Math.cos(angle) * distance).toFixed(1)},${(centerY + Math.sin(angle) * distance).toFixed(1)}`;
  };
  const ring = (scale: number): string => profile.scores.map((_, index) => point(100, index, scale)).join(' ');
  const labels = profile.scores.map((score, index) => {
    const angle = (Math.PI * 2 * index) / profile.scores.length - Math.PI / 2;
    const x = centerX + Math.cos(angle) * (radius + 25);
    const y = centerY + Math.sin(angle) * (radius + 25);
    return `<text class="behavior-radar-label" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle">${escapeHtml(score.label)}</text>`;
  }).join('');
  return `<svg class="${className}" viewBox="0 0 320 280" role="img" aria-label="탐색성, 집중성, 반복성, 몰입성, 규칙성 행동 점수 레이더 차트"><title>행동 프로필 오각형 그래프</title>${[.2, .4, .6, .8, 1].map((scale) => `<polygon class="behavior-radar-ring" points="${ring(scale)}"></polygon>`).join('')}<polygon class="behavior-radar-data" points="${profile.scores.map((score, index) => point(score.score, index)).join(' ')}"></polygon>${profile.scores.map((score, index) => `<circle class="behavior-radar-point" cx="${point(score.score, index).split(',')[0]}" cy="${point(score.score, index).split(',')[1]}" r="4"><title>${escapeHtml(score.label)} ${score.score}점</title></circle>`).join('')}${labels}</svg>`;
}

function renderBehaviorRadar(stats: RecapStats): string {
  const profile = stats.behaviorProfile;
  if (!profile) return '<p class="empty-detail">행동 프로필을 계산할 수 있는 시청 기록이 없습니다.</p>';
  return `<div class="behavior-profile-panel"><div class="behavior-radar-wrap">${renderBehaviorRadarSvg(profile)}</div><div class="behavior-score-list">${profile.scores.map((score) => `<article class="behavior-score"><div class="behavior-score-head"><strong>${escapeHtml(score.label)}</strong><b>${score.score}점</b></div><p>${escapeHtml(score.description)}</p><div class="behavior-evidence">${score.evidence.map((item) => `<span>${escapeHtml(item.label)} <b>${escapeHtml(item.value)}</b></span>`).join('')}</div></article>`).join('')}</div></div>`;
}

function renderStats(stats: RecapStats): void {
  if (!result) return;
  result.hidden = false;
  result.innerHTML = `
    <div class="result-head"><div><p class="kicker">YOUR WATCHING RECEIPT</p><h2>이번 기록에서<br><em>보이는 것들</em></h2></div><p class="date-range">${formatDate(stats.firstDate)}<br>— ${formatDate(stats.lastDate)}</p></div>
    <section class="recap-cards">
      <article class="recap-card style-card"><div class="card-topline"><p class="kicker">YOUR BEHAVIOR PROFILE</p><span class="card-number">01</span></div><h3>${stats.behaviorProfile ? '5개 행동 축으로 본<br>시청 습관' : '데이터 부족'}</h3><strong>${stats.behaviorProfile ? `${Math.round(stats.behaviorProfile.scores.reduce((sum, score) => sum + score.score, 0) / stats.behaviorProfile.scores.length)}점 평균` : '계산 불가'}</strong>${stats.behaviorProfile ? `<div class="behavior-card-radar">${renderBehaviorRadarSvg(stats.behaviorProfile, 'behavior-radar behavior-radar-card')}</div>` : ''}<div class="evidence-list">${stats.behaviorProfile?.scores.map((score) => `<span>${escapeHtml(score.label)} <b>${score.score}점</b></span>`).join('') ?? ''}</div></article>
      <article class="recap-card rhythm-card"><div class="card-topline"><p class="kicker">YOUR RHYTHM</p><span class="card-number">02</span></div><h3>YouTube를 가장 많이<br>보는 시간</h3><strong>${stats.topHour ? `${stats.topHour.hour}:00` : '데이터 부족'}</strong><p>${stats.topDay ? `특히 ${escapeHtml(stats.topDay.name)}에 활동이 많습니다.` : '요일 데이터가 없습니다.'}</p>${renderRhythm(stats, 'rhythm-card-chart')}<div class="rhythm-callout"><span>가장 활발한 요일</span><b>${stats.topDay?.name ?? '데이터 부족'}</b></div></article>
      <article class="recap-card replay-card"><div class="card-topline"><p class="kicker">YOUR REPLAY</p><span class="card-number">03</span></div><h3>당신이 다시 찾은 영상</h3><strong>${stats.topVideos[0] ? escapeHtml(stats.topVideos[0].title) : '데이터 부족'}</strong><p>${stats.topVideos[0] ? `${stats.topVideos[0].count.toLocaleString('ko-KR')}회 다시 봤습니다 · ${escapeHtml(stats.topVideos[0].channelName ?? '채널 정보 없음')}` : '반복 시청 기록이 없습니다.'}</p></article>
      <article class="recap-card binge-card"><div class="card-topline"><p class="kicker">YOUR BINGE</p><span class="card-number">04</span></div><h3>한 번에 이어서 본<br>가장 긴 세션</h3><strong>${stats.longestSession ? `${stats.longestSession.videoCount}개` : '데이터 부족'}</strong><p>${stats.longestSession ? `영상 ${stats.longestSession.videoCount}개를 연달아 봤습니다.` : '세션 데이터가 없습니다.'}</p><div class="binge-line"><i></i><i></i><i></i><i></i><i></i><b>${stats.bingeSessionCount.toLocaleString('ko-KR')}개 몰아보기 세션</b></div></article>
      <article class="recap-card interest-card"><div class="card-topline"><p class="kicker">YOUR INTERESTS</p><span class="card-number">05</span></div><h3>당신이 자주 찾은 주제</h3><div class="interest-bars">${stats.interests.slice(0, 5).map((interest) => `<div class="interest-bar"><span><em aria-hidden="true">${interest.icon}</em>${escapeHtml(interest.category)}</span><b>${interest.score}%</b><i style="width:${Math.max(interest.score, 2)}%"></i></div>`).join('')}</div><p>영상 제목과 검색어를 바탕으로 정리했습니다.</p></article>
    </section>
    <div class="carousel-dots" aria-label="리캡 카드 탐색"></div>
    <details class="analysis-details"><summary class="details-heading"><span class="kicker">DETAIL ANALYSIS</span><strong>상세 분석 보기</strong><span>탭해서 접고 펼치기</span></summary>
    <div class="hero-stat"><span>전체 시청 활동</span><strong>${stats.totalRecords.toLocaleString('ko-KR')}개</strong><small>YouTube 시청 ${stats.videoCount.toLocaleString('ko-KR')} · Music 감상 ${stats.youtubeMusicCount.toLocaleString('ko-KR')} · 게시물 ${stats.communityPostCount.toLocaleString('ko-KR')}</small></div>
    <section class="detail-section behavior-detail"><div class="section-heading"><div><p class="kicker">BEHAVIOR PROFILE</p><h3>시청 행동 벡터</h3></div><span>5개 행동 축</span></div>${renderBehaviorRadar(stats)}</section>
    <section class="coverage-panel"><div><p class="kicker">DATA COVERAGE</p><h3>기록이 담긴 기간</h3></div><dl><div><dt>시청 기록</dt><dd>${formatRange(stats.coverage.watchStart, stats.coverage.watchEnd)}</dd></div><div><dt>검색 기록</dt><dd>${formatRange(stats.coverage.searchStart, stats.coverage.searchEnd)}</dd></div><div><dt>채널 정보 확인</dt><dd>${percent(stats.coverage.watchChannelCoverage)}</dd></div><div><dt>구독 목록</dt><dd>${stats.coverage.hasSubscriptionData ? '확인됨' : '없음'}</dd></div></dl>${renderCoverageMessage(stats)}</section>
    <div class="stat-grid">
      <article><span>가장 많이 본 채널</span><strong>${escapeHtml(stats.topChannel?.name ?? '채널명 확인 불가')}</strong><small>${stats.topChannel ? `${stats.topChannel.count.toLocaleString('ko-KR')}회 시청` : '채널 정보가 없는 기록입니다'}</small></article>
      <article><span>가장 활발했던 요일</span><strong>${stats.topDay?.name ?? '데이터 부족'}</strong><small>${stats.topDay ? `${stats.topDay.count.toLocaleString('ko-KR')}개 기록` : ''}</small></article>
      <article><span>가장 많이 본 시간대</span><strong>${stats.topHour ? `${stats.topHour.hour}시` : '데이터 부족'}</strong><small>${stats.topHour ? `${stats.topHour.count.toLocaleString('ko-KR')}개 기록` : ''}</small></article>
      <article><span>채널 발견률</span><strong>${percent(stats.channelDiscoveryRate)}</strong><small>전체 시청 중 처음 등장한 채널의 시청 비율</small></article>
      <article><span>반복 시청률</span><strong>${percent(stats.repeatViewRate)}</strong><small>반복 재생에 해당하는 시청 기록 비율</small></article>
      <article><span>채널 다양성</span><strong>${percent(stats.channelDiversity)}</strong><small>채널별 시청 분포 기준</small></article>
      <article><span>채널 집중도</span><strong>${percent(stats.channelConcentration)}</strong><small>시청이 소수 채널에 모이는 정도</small></article>
      <article><span>하루 최댓값</span><strong>${stats.maxDailyCount.toLocaleString('ko-KR')}개</strong><small>가장 많이 본 하루</small></article>
    </div>
    <div class="detail-grid">
      <section class="detail-section">
        <div class="section-heading"><div><p class="kicker">MOST REPLAYED</p><h3>자꾸 다시 찾은 영상</h3></div><span>상위 5개</span></div>
        <ol class="video-list">${stats.topVideos.map((video) => `<li><div><strong>${video.url ? `<a href="${escapeHtml(video.url)}" target="_blank" rel="noreferrer">${escapeHtml(video.title)}</a>` : escapeHtml(video.title)}</strong><small>${escapeHtml(video.channelName ?? '채널 정보 없음')}</small></div><b>${video.count}회</b></li>`).join('')}</ol>
      </section>
      <section class="detail-section pulse-section">
        <div class="section-heading"><div><p class="kicker">YOUR RHYTHM</p><h3>시청 리듬</h3></div><span>${stats.activeDays.toLocaleString('ko-KR')}일 활동</span></div>
        <div class="rhythm-row"><span>활동한 날</span><strong>${stats.activeDays.toLocaleString('ko-KR')}일</strong></div>
        <div class="rhythm-row"><span>하루 평균 시청</span><strong>${stats.averagePerActiveDay.toFixed(1)}개</strong></div>
        <div class="rhythm-row"><span>주말에 본 기록</span><strong>${percent(stats.weekendRate)}</strong></div>
        ${renderRhythm(stats)}
        <div class="service-bars">${stats.serviceCounts.map((service) => `<div><span>${escapeHtml(service.name === 'YouTube' ? 'YouTube 시청' : service.name === 'YouTube Music' ? 'YouTube Music 감상' : service.name)}</span><b>${service.count.toLocaleString('ko-KR')}</b><i style="width:${Math.round((service.count / Math.max(stats.videoCount + stats.youtubeMusicCount, 1)) * 100)}%"></i></div>`).join('')}</div>
      </section>
    </div>
    <section class="detail-section session-section">
      <div class="section-heading"><div><p class="kicker">WATCH SESSIONS</p><h3>이어진 시청의 흐름</h3></div><span>15분 간격 기준</span></div>
      <div class="session-grid"><div><span>전체 세션</span><strong>${stats.sessions.length.toLocaleString('ko-KR')}개</strong></div><div><span>몰아보기 세션</span><strong>${stats.bingeSessionCount.toLocaleString('ko-KR')}개</strong></div><div><span>가장 긴 세션</span><strong>${stats.longestSession ? `${stats.longestSession.videoCount}개` : '데이터 부족'}</strong><small>${stats.longestSession ? formatDuration(stats.longestSession.durationMinutes) : '영상 기록이 없습니다.'}</small></div></div>
      <p class="method-note">15분 이내 간격으로 이어진 일반 YouTube 영상 시청을 하나의 세션으로 묶었습니다.</p>
    </section>
    <div class="detail-grid lower-grid">
      <section class="detail-section">
        <div class="section-heading"><div><p class="kicker">RECENTLY WATCHED</p><h3>가장 최근의 기록</h3></div></div>
        <ul class="recent-list">${stats.recentVideos.map((video) => `<li><span>${formatTime(video.time)}</span><strong>${video.titleUrl ? `<a href="${escapeHtml(video.titleUrl)}" target="_blank" rel="noreferrer">${escapeHtml(video.title)}</a>` : escapeHtml(video.title)}</strong></li>`).join('')}</ul>
      </section>
      <section class="detail-section">
        <div class="section-heading"><div><p class="kicker">SEARCH TRAIL</p><h3>많이 검색한 것</h3></div><span>${stats.searchCount.toLocaleString('ko-KR')}회</span></div>
        ${stats.topSearches.length ? `<ol class="search-list">${stats.topSearches.map((search) => `<li><strong>${escapeHtml(search.query)}</strong><b>${search.count}회</b></li>`).join('')}</ol>` : '<p class="empty-detail">검색 기록이 없습니다.</p>'}
      </section>
    </div>
    <div class="music-highlight"><p class="kicker">YOUTUBE MUSIC</p><h3>가장 많이 들은 음악</h3><strong>${stats.topMusic ? escapeHtml(stats.topMusic.title) : '음악 기록 없음'}</strong><small>${stats.topMusic ? `${escapeHtml(stats.topMusic.channelName ?? '아티스트 정보 없음')} · ${stats.topMusic.count.toLocaleString('ko-KR')}회 감상` : 'YouTube Music 기록이 없습니다.'}</small></div>
    <div class="notes"><p><b>${stats.shortCount.toLocaleString('ko-KR')}</b>개의 Shorts는 제목의 #shorts 표식을 기준으로 YouTube 시청 통계에 포함되어 있습니다.</p><p>${searchLabel || 'ZIP 안에서 검색 기록을 찾지 못했습니다.'}</p><p>Takeout에는 실제 재생 시간이 없어 총 시청 시간은 계산하지 않습니다. Live·광고 여부와 관심사 카테고리도 확인할 수 없습니다.</p></div></details>
    <button class="reset" type="button">다시 분석하기</button>
  `;
  const cards = Array.from(result.querySelectorAll<HTMLElement>('.recap-card'));
  const dots = result.querySelector<HTMLElement>('.carousel-dots');
  const cardsContainer = result.querySelector<HTMLElement>('.recap-cards');

  if (dots && cardsContainer) {
    cards.forEach((card, index) => {
      const dot = document.createElement('button');
      dot.className = 'carousel-dot';
      dot.type = 'button';
      dot.setAttribute('aria-label', `${index + 1}번째 리캡 카드 보기`);
      dot.addEventListener('click', () => {
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
      });
      dots.append(dot);
    });

    const dotButtons = Array.from(dots.querySelectorAll<HTMLButtonElement>('.carousel-dot'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const index = cards.indexOf(entry.target as HTMLElement);
        dotButtons.forEach((dot, dotIndex) => dot.classList.toggle('active', dotIndex === index));
      });
    }, { root: cardsContainer, threshold: 0.6 });

    cards.forEach((card) => observer.observe(card));
    dotButtons[0]?.classList.add('active');

    cardsContainer.addEventListener('wheel', (event) => {
      const scrollAmount = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!scrollAmount) return;
      const nextScrollLeft = Math.max(0, Math.min(cardsContainer.scrollLeft + scrollAmount, cardsContainer.scrollWidth - cardsContainer.clientWidth));
      if (nextScrollLeft === cardsContainer.scrollLeft) return;
      event.preventDefault();
      cardsContainer.scrollLeft = nextScrollLeft;
    }, { passive: false });
  }
  result.querySelector<HTMLButtonElement>('.reset')?.addEventListener('click', () => window.location.reload());
}

function setTheme(theme: 'light' | 'dark'): void {
  document.documentElement.dataset.theme = theme;
  const button = document.querySelector<HTMLButtonElement>('#theme-toggle');
  if (button) button.innerHTML = theme === 'dark' ? '<span>☾</span> 다크' : '<span>☼</span> 라이트';
  localStorage.setItem('youtube-me-theme', theme);
}

setTheme(localStorage.getItem('youtube-me-theme') === 'dark' ? 'dark' : 'light');
document.querySelector<HTMLButtonElement>('#theme-toggle')?.addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
});

async function readFile(input: HTMLInputElement): Promise<string | null> {
  const file = input.files?.[0];
  return file ? file.text() : null;
}

document.querySelector<HTMLInputElement>('#zip-file')?.addEventListener('change', async (event) => {
  const input = event.currentTarget as HTMLInputElement;
  if (!status) return;
  status.textContent = 'ZIP 안의 시청 기록과 검색 기록을 찾는 중...';
  try {
    const file = input.files?.[0];
    if (!file) return;
    const parsed = await parseTakeoutZip(file);
    watchStats = calculateStats(parsed.watch, parsed.searches);
    searchLabel = parsed.searches.length
      ? `검색 기록 ${parsed.searches.length.toLocaleString('ko-KR')}개도 함께 확인했습니다.`
      : 'ZIP 안에서 검색 기록을 찾지 못했습니다.';
    status.textContent = `시청 ${watchStats.videoCount.toLocaleString('ko-KR')}개와 검색 ${watchStats.searchCount.toLocaleString('ko-KR')}개를 확인했습니다.`;
    renderStats(watchStats);
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : '파일을 읽지 못했습니다.';
  }
});
