//global variables
if (typeof threads !== 'undefined' && threads != []) {alert('Script is already executing');}
if (typeof cidds === 'undefined') {var cidds = []}
if (typeof media_queue === 'undefined') {var media_queue = []}
if (typeof batch_size === 'undefined') {var batch_size = 1}
if (typeof batch_done === 'undefined') {var batch_done = 0}

settings['parallel_download_limit'] = 6;

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function ciddToURL(cidd) {
  return `https://${cidd['domain']}/community/course/${cidd['cid']}`;
}

async function fetchMeta(cidd) {
  const meta = {
    'url': ciddToURL(cidd),
    'cid': cidd['cid'],
    'proper name': '',
    'thumbnail': '',  
    'url name': cidd['cid'],
    'number of levels': '??',
    'number of items': '??',
    'description': '',
    'author': '',
    'ava': 'https://static.memrise.com/accounts/img/placeholders/empty-avatar-2.png', // -> rnd 1..4
  };

  let course_page;
  try {
    course_page = await fetch(ciddToURL(cidd));
  } catch(err) {
    console.error(`failed to fetch course ${cidd['cid']} html`, err);
  }
  if (!course_page) return meta;

  meta['url name'] = course_page.url.split("/")[6]; // course name from the ending of the url after redirections

  try {
    const parser =  new DOMParser();
    const doc = parser.parseFromString(await course_page.text(), "text/html");

    meta['proper name'] = doc.querySelector('.course-name').innerText;
    meta['thumbnail'] = doc.querySelector('.course-photo img').src;
    meta['number of levels'] = (query => (query ? query.childElementCount : 1))(doc.querySelector('div.levels'));
    meta['description'] = (desc => (desc ? desc.innerText : ""))(doc.querySelector('.course-description.text'));
    meta['author'] = doc.querySelector('.creator-name span').innerText;
    meta['ava'] = doc.querySelector('.creator-image img').src;
    meta['number of items'] = parseInt(doc.querySelector('.progress-box-title').innerText.split('/').at(-1).trim());
  } catch(err) {
    console.error(`failed to parse course ${cidd['cid']} html`, err);    
  }

	console.log(JSON.stringify(meta));

  return meta;
}

//THE MAIN FUNCTION FOR SCANNING ALL LEVELS OF A COURSE
async function scanCourse(cidd, threadN) {
  const progress_bar = scanProgressBar(threadN);
  function updScanProgress(progress) {
    if (progress > 0) {
      console.log(`thread: ${threadN} | cid: ${cidd['cid']} | ${progress}%`);
      if (progress_bar) {
        progress_bar.style.width = Math.min(100, Math.round(100. * progress)/100) + "%";
      }
    } else {
      console.log(`thread: ${threadN} | Start scanning ${cidd['cid']}`);
      if (progress_bar) {
        progress_bar.classList.add('resetting');
        progress_bar.style.width = "0%";
        setTimeout(() => {
          progress_bar.classList.remove('resetting');
        }, 500);
      }
    }
  }

  //init
  let progress = 0;
  progress_bar.setAttribute("progress-text", "");
  updScanProgress(progress);

  //scan emulation
  const meta = await fetchMeta(cidd);
  if (progress_bar) {
    progress_bar.setAttribute("progress-text", meta['proper name'] || meta['url name']);
  }
  while (progress < 100) {
    await sleep(Math.floor(Math.random() * 1000 + 500));
    progress += Math.floor(Math.random() * 20 + 10);
    updScanProgress(progress);
  }
  await sleep(700);

}

function updBatchProgress(cidd) {
  const done_str = `${batch_done}/${batch_size}`;
  if (cidd) {
    console.log(`cid: ${cidd['cid']} | scan complete (${done_str})`);
  }  
  const batch_progress_bar = batchProgressBar();
  if (!batch_progress_bar) return;
  batch_progress_bar.setAttribute("progress-text", done_str);
  batch_progress_bar.style.width = Math.min(100, Math.round(10000. * batch_done/batch_size)/100) + "%";
}

function updMediaProgress(media_done) {
  const media_total = 100;
  const done_str = `${media_done}/${media_total}`;
  const media_progress_bar = mediaProgressBar();
  if (!media_progress_bar) return;
  if (media_done === "done") {
    media_progress_bar.setAttribute("progress-text", "done!");
    media_progress_bar.classList.add('done');
    media_progress_bar.style.width = "100%";
    return;
  }
  media_progress_bar.setAttribute("progress-text", done_str);
  media_progress_bar.style.width = Math.min(100, Math.round(10000. * media_done/media_total)/100) + "%";
}



async function scanThread(threadN) {
  let cidd;

  function ciddParse(cidd) {
    try {
      return JSON.parse(cidd);
    } catch (err) {
      return '';
    }
  }

  while (cidd = ciddParse(cidds.pop())) {
    if (cidd['domain'] === tabDomain) {
      await scanCourse(cidd, threadN);
    } else {
      console.log(`${cidd} does not match tab domain ${tabDomain}`);
    }
    batch_done++;
    updBatchProgress(cidd);
  }

  removeScanBar(threadN);
}


//main execution
(async () => {
  tabDomain = window.location.toString().split("/")[2];
  if (tabDomain !== 'app.memrise.com' && tabDomain !== 'community-courses.memrise.com') {
      alert("The extension should be used on the memrise.com site"); 
      return -1;
  }

  //global scan variables
  batch_size = cidds.length;
  batch_done = 0;
  threads = [];
  media_queue = [];
  progressBarContainer();
  for (let threadCounter = 0; threadCounter < settings['parallel_download_limit'] && cidds.length > 0; threadCounter++) {
    // console.log(`new thread started: ${threadCounter} ${settings['parallel_download_limit']} ${cidds.length}`);
    threads.push(scanThread(threadCounter));
  }
  updBatchProgress("");
  await Promise.all(threads);
  console.log('scanning complete');
  await sleep(500);

  media_progress = 0;

  //media download emulation
  updMediaProgress("");
  while (media_progress < 100) {
    await sleep(Math.floor(Math.random() * 100 + 50));
    media_progress += Math.floor(Math.random() * 2 + 1);
    updMediaProgress(media_progress);
  }

  setTimeout(()=>{
    updMediaProgress("done");
  }, 550);
  console.log('media download complete');
  
})();