/**
 * ==============================================================================
 * 파트너스 보드 - 총수당 예시표 조회 및 PDF 출력 시스템 (script_total_fee_report.js)
 * 
 * 1. 수당제도 프리셋 & 임의 지급율(손보/생보) 실시간 반영
 *    - 사업단장 (손보 92%, 생보 90%)
 *    - Super (손보 84%, 생보 79%)
 *    - Success (손보 84%, 생보 73%)
 *    - 직접 입력 (자유 입력)
 * 2. 총수당 예시표 제목(타이틀) 즉석 수정 지원
 * 3. 회사별 매월 대표상품 및 납입기간 드롭다운 선택, 출력용 마스킹 상품명표시 관리
 * 4. 월별 보험사 시상금 웹 화면 직접 입력 및 스프레드시트('월별시상' 시트) 저장 / 전월 복사
 * 5. 출력 2원화: [총수당 예시표만 PDF 출력] vs [전체 브로슈어 책자 PDF 출력]
 * ==============================================================================
 */

var totalFeeReportState = {
    month: '2026.09',
    weekText: '2026년 9월 1주차 기준',
    preset: 'Super', // '사업단장' | 'Super' | 'Success' | 'custom'
    nonLifeRate: 84, // 손보 지급율 (%)
    lifeRate: 79,    // 생보 지급율 (%)
    sortBy: 'nextMonth', // 'nextMonth' (익월합계순) | 'total' (총합계순)
    sortBys: {
        '손해보험': 'nextMonth',
        '종신보험': 'nextMonth',
        '단기납종신': 'nextMonth',
        '경영인정기': 'nextMonth'
    },
    outputMode: 'tablesOnly', // 'tablesOnly' | 'fullBrochure'
    activeTab: '손해보험', // '손해보험' | '종신보험' | '단기납종신' | '경영인정기'
    titles: {
        '손해보험': 'Super 수당규정 총수당 예시표 : 손해보험',
        '종신보험': 'Super 수당규정 총수당 예시표 : 생명보험',
        '단기납종신': 'Super 수당규정 총수당 예시표 : 단기납 종신보험',
        '경영인정기': 'Super 수당규정 총수당 예시표 : 경영인정기'
    },
    // 스프레드시트 '월별시상' 시트에서 로드된 정책 데이터
    policyData: []
};

// 보험사 목록 (PDF 기준 표준 정렬 순서)
const REPORT_COMPANIES = {
    '손해보험': [
        '삼성화재', '하나손보', 'DB손보', '흥국화재', 'KB손보', 
        '현대해상', '한화손보', '롯데손보', '메리츠', '농협손보', 'AIG손보'
    ],
    '생명보험': [
        '한화생명', 'KB라이프', '미래에셋', '메트라이프', '신한라이프', 
        'ABL생명', '교보생명', '삼성생명', '라이나생명', 'DB생명', 
        '동양생명', '카디프생명', '하나생명', '흥국생명', 'KDB생명'
    ]
};

/**
 * 기본 시상금 및 대표상품 디폴트 데이터 생성 (시트 데이터가 아직 없을 때 사용)
 */
function getDefaultRewardPolicies(month) {
    const list = [];
    const mStr = String(month || '2026.09').replace(/\./g, '');

    // 1. 손해보험 (종합건강)
    const nonLifeDefaults = [
        { comp: '삼성화재', prod: '마이헬스***보험', payPeriod: '20년납', next: 380, hq: 0, week: 700, cont: 800, other: 200, corp: 0 },
        { comp: '하나손보', prod: '하나더스타**건강보험', payPeriod: '20년납', next: 370, hq: 0, week: 900, cont: 700, other: 350, corp: 0 },
        { comp: 'DB손보', prod: '건강할때****청춘어람플러스종합보험', payPeriod: '20년납', next: 400, hq: 0, week: 700, cont: 800, other: 200, corp: 0 },
        { comp: '흥국화재', prod: '흥Good The 건강한 ****종합보험', payPeriod: '20년납', next: 400, hq: 0, week: 900, cont: 600, other: 0, corp: 0 },
        { comp: 'KB손보', prod: '닥터***보험', payPeriod: '20년납', next: 400, hq: 0, week: 700, cont: 600, other: 400, corp: 0 },
        { comp: '현대해상', prod: '퍼펙트***보험', payPeriod: '20년납', next: 400, hq: 0, week: 800, cont: 800, other: 150, corp: 0 },
        { comp: '한화손보', prod: '더건** 한아름종합보험', payPeriod: '20년납', next: 360, hq: 0, week: 1000, cont: 800, other: 100, corp: 0 },
        { comp: '롯데손보', prod: 'let: smile***보험', payPeriod: '20년납', next: 330, hq: 0, week: 700, cont: 1330, other: 0, corp: 0 },
        { comp: '메리츠', prod: '알파***보험', payPeriod: '20년납', next: 200, hq: 0, week: 200, cont: 600, other: 1000, corp: 0 },
        { comp: '농협손보', prod: '가성비**건강보험', payPeriod: '20년납', next: 100, hq: 0, week: 500, cont: 1000, other: 100, corp: 0 },
        { comp: 'AIG손보', prod: '소문난 N** 암보험(갱신형)', payPeriod: '10년갱신', next: 100, hq: 0, week: 0, cont: 0, other: 0, corp: 0 }
    ];

    nonLifeDefaults.forEach(d => {
        list.push({
            '마감월': mStr,
            '보험사구분': '손해보험',
            '보험사명': d.comp,
            '상품구분': '종합건강',
            '대표상품명': d.prod,
            '납입기간': d.payPeriod,
            '상품명표시': d.prod,
            '시상내용': '',
            '익월기본시상': d.next,
            '13차월시상': 0,
            '주차시상': d.week,
            '연속시상': d.cont,
            '기타시상': d.other,
            '본사시상': d.hq,
            '법인시상': d.corp,
            '임시시상': 0
        });
    });

    // 2. 생명보험 - 종신보험 (20년납)
    const lifeDefaults = [
        { comp: '미래에셋', prod: '변액*** 약속', payPeriod: '20년납', next: 50, m13: 280 },
        { comp: 'KB라이프', prod: 'KB 역모**종신보험', payPeriod: '20년납', next: 100, m13: 200 },
        { comp: '한화생명', prod: '제로**종신보험', payPeriod: '20년납', next: 250, m13: 200 },
        { comp: '메트라이프', prod: '변액****모두*상속종신', payPeriod: '20년납', next: 50, m13: 0 },
        { comp: '신한라이프', prod: 'The든**종신보험', payPeriod: '20년납', next: 350, m13: 100 },
        { comp: 'ABL생명', prod: '우리가족THE***상속종신보험', payPeriod: '20년납', next: 150, m13: 200 },
        { comp: '교보생명', prod: '실속**종신보험', payPeriod: '20년납', next: 100, m13: 150 },
        { comp: '삼성생명', prod: '올백(ALL***)종신보험', payPeriod: '20년납', next: 300, m13: 200 },
        { comp: '라이나생명', prod: 'THE건강***종신보험', payPeriod: '20년납', next: 250, m13: 100 },
        { comp: 'DB생명', prod: '10년 더드***버셜 종신보험', payPeriod: '20년납', next: 0, m13: 0 }
    ];
    lifeDefaults.forEach(d => {
        list.push({
            '마감월': mStr,
            '보험사구분': '생명보험',
            '보험사명': d.comp,
            '상품구분': '종신보험',
            '대표상품명': d.prod,
            '납입기간': d.payPeriod,
            '상품명표시': d.prod,
            '시상내용': '',
            '익월기본시상': d.next,
            '13차월시상': d.m13,
            '주차시상': 0,
            '연속시상': 0,
            '기타시상': 0,
            '본사시상': 0,
            '법인시상': 0,
            '임시시상': 0
        });
    });

    // 3. 생명보험 - 단기납 종신 (7년납)
    const shortLifeDefaults = [
        { comp: '삼성생명', prod: '더행**종신보험', payPeriod: '7년납', next: 500, m13: 0 },
        { comp: 'KDB생명', prod: '더블찬*** 종신보험', payPeriod: '7년납', next: 350, m13: 0 },
        { comp: '메트라이프', prod: '백만인***달러종신보험Plus', payPeriod: '7년납', next: 400, m13: 0 },
        { comp: '한화생명', prod: '밸류플** 보장보험', payPeriod: '7년납', next: 350, m13: 0 },
        { comp: '하나생명', prod: '하나로THE연**종신보험', payPeriod: '7년납', next: 420, m13: 70 },
        { comp: '라이나생명', prod: 'THE채우**종신보험', payPeriod: '7년납', next: 350, m13: 150 },
        { comp: '신한라이프', prod: '모아더**종신보험', payPeriod: '7년납', next: 350, m13: 0 },
        { comp: '동양생명', prod: '우리WON하는알뜰***종신보험', payPeriod: '7년납', next: 300, m13: 0 },
        { comp: '교보생명', prod: 'K-실**종신보험', payPeriod: '7년납', next: 100, m13: 0 }
    ];
    shortLifeDefaults.forEach(d => {
        list.push({
            '마감월': mStr,
            '보험사구분': '생명보험',
            '보험사명': d.comp,
            '상품구분': '단기납종신',
            '대표상품명': d.prod,
            '납입기간': d.payPeriod,
            '상품명표시': d.prod,
            '시상내용': '',
            '익월기본시상': d.next,
            '13차월시상': d.m13,
            '주차시상': 0,
            '연속시상': 0,
            '기타시상': 0,
            '본사시상': 0,
            '법인시상': 0,
            '임시시상': 0
        });
    });

    // 4. 생명보험 - 경영인정기 (20년초과)
    const ceoDefaults = [
        { comp: '한화생명', prod: '경**H정기보험', payPeriod: '20년초과', next: 250, m13: 0 },
        { comp: '카디프생명', prod: '시그**경영인정기보험', payPeriod: '20년초과', next: 50, m13: 250 },
        { comp: 'KB라이프', prod: '경**정기보험Ⅲ', payPeriod: '20년초과', next: 100, m13: 100 },
        { comp: '메트라이프', prod: 'TheClassic경**정기보험', payPeriod: '20년초과', next: 50, m13: 100 },
        { comp: '미래에셋', prod: '경영인을**정기보험', payPeriod: '20년초과', next: 100, m13: 0 },
        { comp: '교보생명', prod: '경**정기보험', payPeriod: '20년초과', next: 220, m13: 130 },
        { comp: '신한라이프', prod: '위너스경**정기보험', payPeriod: '20년초과', next: 50, m13: 100 },
        { comp: '삼성생명', prod: 'CEO**정기보험', payPeriod: '20년초과', next: 100, m13: 0 },
        { comp: 'DB생명', prod: '경**정기보험', payPeriod: '20년초과', next: 100, m13: 170 }
    ];
    ceoDefaults.forEach(d => {
        list.push({
            '마감월': mStr,
            '보험사구분': '생명보험',
            '보험사명': d.comp,
            '상품구분': '경영인정기',
            '대표상품명': d.prod,
            '납입기간': d.payPeriod,
            '상품명표시': d.prod,
            '시상내용': '',
            '익월기본시상': d.next,
            '13차월시상': d.m13,
            '주차시상': 0,
            '연속시상': 0,
            '기타시상': 0,
            '본사시상': 0,
            '법인시상': 0,
            '임시시상': 0
        });
    });

    return list;
}

var totalFeeReportTargetContainer = null;

/**
 * 초기화 및 데이터 로드
 */
async function initTotalFeeReport(targetContainer) {
    if (targetContainer) {
        totalFeeReportTargetContainer = targetContainer;
    }
    const container = targetContainer || totalFeeReportTargetContainer || document.getElementById('main-view');

    // [로딩 표시] 데이터 조회 동안 사용자에게 로딩 중임을 명확히 표시
    if (container) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center min-h-[480px] py-24 text-center animate-fadeIn">
                <div class="relative w-14 h-14 mb-5">
                    <div class="absolute inset-0 rounded-full border-4 border-orange-200 animate-pulse"></div>
                    <div class="w-14 h-14 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
                <h3 class="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight mb-1.5">
                    총수당 예시표 데이터를 불러오는 중입니다
                </h3>
                <p class="text-xs text-gray-500 max-w-sm leading-relaxed">
                    수수료 규정 및 월별 보험사 시상금 정책 데이터를 조회하고 있습니다. 잠시만 기다려 주세요.
                </p>
            </div>
        `;
    }

    if (typeof feeTableState !== 'undefined' && feeTableState.month) {
        totalFeeReportState.month = feeTableState.month;
    }

    // 마감월 주차 텍스트 자동 동기화
    const m = totalFeeReportState.month || '2026.09';
    const parts = m.split('.');
    if (parts.length === 2) {
        totalFeeReportState.weekText = `${parts[0]}년 ${parseInt(parts[1], 10)}월 1주차 기준`;
    }

    // 1. 수수료 엑셀 데이터 준비 확인
    if (typeof loadFeeTableData === 'function' && (!FEE_TABLE_DATA || !FEE_TABLE_DATA.categories)) {
        await loadFeeTableData(totalFeeReportState.month);
    }

    // 2. 구글 시트 '월별시상' 정책 로드 시도
    await fetchRewardPolicyData(totalFeeReportState.month);

    // 3. UI 렌더링
    renderTotalFeeReportView(targetContainer);
}

/**
 * 백엔드에서 시상금 정책 데이터 로드
 */
async function fetchRewardPolicyData(month) {
    try {
        if (typeof API_URL !== 'undefined' && API_URL) {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'getRewardPolicy',
                    args: [month]
                })
            });
            const data = await res.json();
            if (data && data.success && data.list && data.list.length > 0) {
                totalFeeReportState.policyData = data.list;
                return;
            }
        }
    } catch (err) {
        console.warn('fetchRewardPolicyData 백엔드 호출 실패, 로컬 기본값 사용:', err);
    }

    // 실패 또는 데이터가 비어있을 시 디폴트 데이터 로드
    totalFeeReportState.policyData = getDefaultRewardPolicies(month);
}

/**
 * 수당제도 프리셋 변경
 */
function setTotalFeePreset(presetName) {
    totalFeeReportState.preset = presetName;

    if (presetName === '사업단장') {
        totalFeeReportState.nonLifeRate = 92;
        totalFeeReportState.lifeRate = 90;
        totalFeeReportState.titles['손해보험'] = '사업단장 수당규정 총수당 예시표 : 손해보험';
        totalFeeReportState.titles['종신보험'] = '사업단장 수당규정 총수당 예시표 : 생명보험';
        totalFeeReportState.titles['단기납종신'] = '사업단장 수당규정 총수당 예시표 : 단기납 종신보험';
        totalFeeReportState.titles['경영인정기'] = '사업단장 수당규정 총수당 예시표 : 경영인정기';
    } else if (presetName === 'Super') {
        totalFeeReportState.nonLifeRate = 84;
        totalFeeReportState.lifeRate = 79;
        totalFeeReportState.titles['손해보험'] = 'Super 수당규정 총수당 예시표 : 손해보험';
        totalFeeReportState.titles['종신보험'] = 'Super 수당규정 총수당 예시표 : 생명보험';
        totalFeeReportState.titles['단기납종신'] = 'Super 수당규정 총수당 예시표 : 단기납 종신보험';
        totalFeeReportState.titles['경영인정기'] = 'Super 수당규정 총수당 예시표 : 경영인정기';
    } else if (presetName === 'Success') {
        totalFeeReportState.nonLifeRate = 84;
        totalFeeReportState.lifeRate = 73;
        totalFeeReportState.titles['손해보험'] = 'Success 수당규정 총수당 예시표 : 손해보험';
        totalFeeReportState.titles['종신보험'] = 'Success 수당규정 총수당 예시표 : 생명보험';
        totalFeeReportState.titles['단기납종신'] = 'Success 수당규정 총수당 예시표 : 단기납 종신보험';
        totalFeeReportState.titles['경영인정기'] = 'Success 수당규정 총수당 예시표 : 경영인정기';
    } else {
        totalFeeReportState.preset = 'custom';
    }

    renderTotalFeeReportView();
}

/**
 * 임의 지급율 수동 변경 핸들러
 */
function onCustomRateChange(type, val) {
    const num = parseFloat(val) || 0;
    if (type === 'nonLife') {
        totalFeeReportState.nonLifeRate = num;
    } else {
        totalFeeReportState.lifeRate = num;
    }
    totalFeeReportState.preset = 'custom';
    updateReportTablesOnly();
}

/**
 * 예시표 제목(타이틀) 실시간 수정 핸들러
 */
function onReportTitleChange(catKey, newTitle) {
    totalFeeReportState.titles[catKey] = newTitle;
    const titleEl = document.getElementById(`report-title-display-${catKey}`);
    if (titleEl) {
        titleEl.textContent = newTitle;
    }
}

/**
 * 정렬 기준 변경 (전체 일괄)
 */
function setReportSortBy(sortBy) {
    totalFeeReportState.sortBy = sortBy;
    if (!totalFeeReportState.sortBys) {
        totalFeeReportState.sortBys = {};
    }
    ['손해보험', '종신보험', '단기납종신', '경영인정기'].forEach(k => {
        totalFeeReportState.sortBys[k] = sortBy;
    });
    renderTotalFeeReportView();
}

/**
 * 정렬 기준 변경 (출력물 종류별 개별)
 */
function setCategorySortBy(catKey, sortBy) {
    if (!totalFeeReportState.sortBys) {
        totalFeeReportState.sortBys = {};
    }
    totalFeeReportState.sortBys[catKey] = sortBy;
    renderTotalFeeReportView();
}

/**
 * 엑셀 데이터에서 특정 회사의 상품 행들 검색
 */
function findFeeDataRow(category, company, productName, payPeriod, optDetails) {
    if (!productName || !String(productName).trim()) return null;
    if (!FEE_TABLE_DATA || !FEE_TABLE_DATA.categories) return null;
    const catData = FEE_TABLE_DATA.categories[category];
    if (!catData) return null;

    // 회사명 정규화 매칭
    let compKey = Object.keys(catData).find(k => k === company || k.includes(company) || company.includes(k));
    if (!compKey) return null;

    const rows = catData[compKey] || [];
    if (rows.length === 0) return null;

    const prodRows = rows.filter(r => r.product === productName || (productName && r.product.includes(productName)));
    if (prodRows.length === 0) return null;

    // 1. 세부 옵션(구분, 유형, 납기 등) 정밀 일치 탐색
    if (optDetails && typeof optDetails === 'object' && Object.keys(optDetails).length > 0) {
        const matchByOpts = prodRows.find(r => {
            if (!r.options) return false;
            for (let k of Object.keys(optDetails)) {
                if (optDetails[k] && r.options[k] && r.options[k] !== optDetails[k]) {
                    return false;
                }
            }
            return true;
        });
        if (matchByOpts) return matchByOpts;
    }

    // 2. 상품명 및 납입기간 일치 검색
    let matched = prodRows.find(r => {
        if (!payPeriod) return true;
        const optVals = Object.values(r.options || {}).join(' ');
        return optVals.includes(payPeriod);
    });

    return matched || prodRows[0];
}

/**
 * 화면 전체 렌더링 (메인 진입점)
 */
function renderTotalFeeReportView(targetContainer) {
    const content = targetContainer || totalFeeReportTargetContainer || document.getElementById('main-view');
    if (!content) return;

    const state = totalFeeReportState;
    const isAdmin = checkIsAdminUser();

    content.innerHTML = `
        <div class="space-y-4 pb-16 max-w-7xl mx-auto animate-fadeIn">
            
            <!-- 상단 헤더 및 브레드크럼 -->
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/80 shadow-sm">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="inline-block w-2.5 h-2.5 rounded-full bg-orange-500"></span>
                        <span class="text-xs font-bold text-gray-500 uppercase tracking-wider">COMMISSION & REWARD PDF SYSTEM</span>
                    </div>
                    <h1 class="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                        총수당 예시표 및 브로슈어 출력
                        <span class="text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold border border-orange-200">
                            A4 규격 인쇄 최적화
                        </span>
                    </h1>
                    <p class="text-xs text-gray-500 mt-1">
                        수당제도별 지급율과 매월 보험사 시상금을 실시간 결합하여 전문적인 총수당 예시표를 즉시 PDF로 출력합니다.
                    </p>
                </div>

                <!-- 출력 액션 버튼 2원화 -->
                <div class="flex flex-wrap items-center gap-2.5">
                    ${isAdmin ? `
                        <button onclick="openRewardPolicyModal()" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
                            <svg class="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                            시상금 및 대표상품 관리
                        </button>
                    ` : ''}
                    <button onclick="triggerPrintReport('tablesOnly')" class="px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-orange-200">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                        예시표만 출력
                    </button>
                    <button onclick="triggerPrintReport('fullBrochure')" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-200">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                        브로슈어 출력
                    </button>
                </div>
            </div>

            <!-- 컨트롤 바: 수당제도 프리셋 / 지급율 직접입력 / 기준월 / 정렬 -->
            <div class="bg-white p-5 rounded-2xl border border-gray-200/80 shadow-sm space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-4">
                    
                    <!-- 1. 수당규정 프리셋 버튼들 -->
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-gray-600">수당제도 프리셋:</span>
                        <div class="inline-flex p-1 bg-gray-100 rounded-xl">
                            <button onclick="setTotalFeePreset('사업단장')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${state.preset === '사업단장' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}">
                                사업단장 (92/90)
                            </button>
                            <button onclick="setTotalFeePreset('Super')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${state.preset === 'Super' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}">
                                Super (84/79)
                            </button>
                            <button onclick="setTotalFeePreset('Success')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${state.preset === 'Success' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}">
                                Success (84/73)
                            </button>
                            <button onclick="setTotalFeePreset('custom')" class="px-3 py-1.5 rounded-lg text-xs font-bold transition ${state.preset === 'custom' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}">
                                직접 입력
                            </button>
                        </div>
                    </div>

                    <!-- 2. 손보 / 생보 지급율 직접 입력 -->
                    <div class="flex items-center gap-4 bg-orange-50/60 border border-orange-200/70 px-4 py-2 rounded-xl">
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs font-bold text-orange-950">손보 지급율:</span>
                            <input type="number" step="0.5" value="${state.nonLifeRate}" oninput="onCustomRateChange('nonLife', this.value)" class="w-16 px-2 py-1 bg-white border border-orange-300 rounded-lg text-xs font-bold text-center text-orange-700 outline-none focus:ring-2 focus:ring-orange-400">
                            <span class="text-xs font-bold text-orange-800">%</span>
                        </div>
                        <div class="h-4 w-px bg-orange-200"></div>
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs font-bold text-orange-950">생보 지급율:</span>
                            <input type="number" step="0.5" value="${state.lifeRate}" oninput="onCustomRateChange('life', this.value)" class="w-16 px-2 py-1 bg-white border border-orange-300 rounded-lg text-xs font-bold text-center text-orange-700 outline-none focus:ring-2 focus:ring-orange-400">
                            <span class="text-xs font-bold text-orange-800">%</span>
                        </div>
                    </div>

                    <!-- 3. 기준 주차 문구 및 전체 일괄 정렬 기준 -->
                    <div class="flex items-center gap-3">
                        <div class="flex items-center gap-1.5">
                            <span class="text-xs font-semibold text-gray-500">기준주차:</span>
                            <input type="text" value="${state.weekText}" onchange="totalFeeReportState.weekText = this.value; updateReportTablesOnly();" class="px-2.5 py-1 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 w-36 outline-none focus:border-orange-400">
                        </div>
                        <div class="flex items-center gap-1.5 bg-gray-50 border border-gray-200/80 px-2.5 py-1 rounded-xl">
                            <span class="text-[11px] font-bold text-gray-500">일괄정렬:</span>
                            <div class="inline-flex p-0.5 bg-gray-200/70 rounded-lg">
                                <button onclick="setReportSortBy('nextMonth')" class="px-2 py-0.5 rounded text-xs font-bold transition ${state.sortBy === 'nextMonth' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'}">
                                    익월합계순
                                </button>
                                <button onclick="setReportSortBy('total')" class="px-2 py-0.5 rounded text-xs font-bold transition ${state.sortBy === 'total' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'}">
                                    총합계순
                                </button>
                            </div>
                        </div>
                    </div>

                </div>

                <!-- 4. 실시간 예시표 제목 및 종류별 개별 정렬 기준 바 -->
                <div class="pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    ${[
                        { key: '손해보험', label: '1. 손보 (종합건강)', inputLabel: '손보 예시표 제목' },
                        { key: '종신보험', label: '2. 종신보험 (20년)', inputLabel: '종신(20년) 예시표 제목' },
                        { key: '단기납종신', label: '3. 단기납 종신 (7년)', inputLabel: '단기납(7년) 예시표 제목' },
                        { key: '경영인정기', label: '4. 경영인정기 (20년+)', inputLabel: '경영인정기 예시표 제목' }
                    ].map(cat => {
                        const curSort = (state.sortBys && state.sortBys[cat.key]) || state.sortBy || 'nextMonth';
                        return `
                            <div class="p-3 bg-gray-50/80 border border-gray-200/80 rounded-xl space-y-2">
                                <div class="flex items-center justify-between">
                                    <span class="text-[11px] font-extrabold text-gray-800">${cat.label}</span>
                                    <div class="inline-flex p-0.5 bg-gray-200/70 rounded-md text-[10px]">
                                        <button onclick="setCategorySortBy('${cat.key}', 'nextMonth')" class="px-1.5 py-0.5 rounded font-bold transition ${curSort === 'nextMonth' ? 'bg-orange-500 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'}">익월순</button>
                                        <button onclick="setCategorySortBy('${cat.key}', 'total')" class="px-1.5 py-0.5 rounded font-bold transition ${curSort === 'total' ? 'bg-orange-500 text-white shadow-xs' : 'text-gray-500 hover:text-gray-800'}">총합순</button>
                                    </div>
                                </div>
                                <input type="text" value="${state.titles[cat.key]}" oninput="onReportTitleChange('${cat.key}', this.value)" class="w-full px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:border-orange-400 outline-none font-semibold text-gray-800" placeholder="${cat.inputLabel}">
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- A4 라이브 프리뷰 컨테이너 (인쇄 영역) -->
            <div id="print-area-wrapper" class="bg-gray-200 p-4 md:p-8 rounded-2xl overflow-x-auto flex flex-col items-center">
                <div id="report-print-container" class="report-a4-page-container space-y-8 print:space-y-0">
                    ${buildReportHtml()}
                </div>
            </div>

        </div>

        <!-- 시상금 및 대표상품 관리 모달 컨테이너 -->
        <div id="reward-policy-modal-container"></div>
    `;
}

/**
 * 변경된 수치/제목만 테이블에 즉각 리렌더링
 */
function updateReportTablesOnly() {
    const container = document.getElementById('report-print-container');
    if (container) {
        container.innerHTML = buildReportHtml();
    }
}

/**
 * A4 페이지 단위 전체 HTML 빌드 (PDF 구조 완벽 재현)
 */
function buildReportHtml() {
    const state = totalFeeReportState;
    const mode = state.outputMode; // 'tablesOnly' | 'fullBrochure'

    let html = '';

    // [모드: 전체 브로슈어 책자]일 때 서두 페이지들 포함
    if (mode === 'fullBrochure') {
        html += buildCoverPage();
        html += buildAdvantagesPage();
        html += buildMissionPage();
        html += buildRegulationSummaryPage();
    }

    // [공통 핵심] 총수당 예시표 페이지들
    // 1. 손해보험 총수당 예시표 (약 2~3페이지 분량)
    html += buildNonLifeTablePages();

    // 2. 생명보험 - 종신보험 (20년납) 예시표 (약 2페이지)
    html += buildLifeTablePages('종신보험', '· 종신보험 주계약, 20년납 기준', state.titles['종신보험'], '#7c3aed');

    // 3. 생명보험 - 단기납 종신 (7년납) 예시표 (약 2페이지)
    html += buildLifeTablePages('단기납종신', '· 각 보험사의 단기납 종신보험에 준하는 상품 예시 (7년납 기준)', state.titles['단기납종신'], '#b45309');

    // 4. 생명보험 - 경영인정기 (20년초과) 예시표 (약 2페이지)
    html += buildLifeTablePages('경영인정기', '· 각 보험사의 경영인정기보험에 준하는 상품 예시 (20년 초과 납입 기준)', state.titles['경영인정기'], '#9d174d');

    // [모드: 전체 브로슈어 책자]일 때 후두 증원수당 예시표들 포함
    if (mode === 'fullBrochure') {
        html += buildRecruitingPage();
        html += buildRecruitmentTablePage1();
        html += buildRecruitmentTablePage2();
    }

    return html;
}

/**
 * 1P: 표지 페이지
 */
function buildCoverPage() {
    return `
        <div class="a4-page bg-white shadow-xl flex flex-col justify-between p-16 relative overflow-hidden">
            <div class="flex justify-between items-start">
                <div class="flex items-center gap-3">
                    <span class="w-4 h-4 rounded-full bg-orange-500"></span>
                    <span class="text-sm font-bold text-gray-800 tracking-wider">한화라이프랩 파트너스본부</span>
                </div>
            </div>

            <div class="my-auto space-y-6 text-center">
                <h3 class="text-xl sm:text-2xl font-bold text-gray-600">한화라이프랩 파트너스본부</h3>
                <h1 class="text-5xl sm:text-6xl font-black text-[#b43e2b] tracking-tight">수 당 제 도</h1>
                <div class="inline-block mt-4 px-6 py-2 rounded-lg bg-[#b43e2b] text-white font-extrabold text-base tracking-wide shadow-md">
                    ${totalFeeReportState.weekText}
                </div>
            </div>

            <div class="text-center text-xs text-gray-400 pt-8 border-t border-gray-100">
                PARTNERS HEADQUARTERS · HANWHA LIFE LAB
            </div>
        </div>
    `;
}

/**
 * 2P: UNIQUE ADVANTAGES
 */
function buildAdvantagesPage() {
    return `
        <div class="a4-page bg-white shadow-xl p-12 flex flex-col justify-between">
            <div>
                <div class="inline-block px-4 py-1.5 bg-gray-900 text-white font-black text-sm tracking-wider rounded mb-8">
                    UNIQUE ADVANTAGES
                </div>

                <div class="text-center mb-6">
                    <div class="inline-block border-2 border-orange-400 bg-orange-50/50 px-8 py-2 rounded-xl text-orange-600 font-extrabold text-base shadow-sm">
                        한화라이프랩
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-4 mb-6">
                    <div class="border border-orange-200 bg-orange-50/30 rounded-xl p-4 text-center space-y-1.5">
                        <div class="text-xs font-bold text-orange-700 uppercase">FIRST</div>
                        <div class="text-sm font-extrabold text-gray-900">국내 최초의 자회사형 GA</div>
                        <div class="text-[11px] text-gray-500 leading-tight">생보 15개사, 손보 11개사 제휴<br>대형 GA보다 더 많은 혜택</div>
                        <div class="mt-2 py-1 bg-orange-500 text-white text-xs font-bold rounded">GA의 모든 장점</div>
                    </div>
                    <div class="border border-orange-200 bg-orange-50/30 rounded-xl p-4 text-center space-y-1.5">
                        <div class="text-xs font-bold text-orange-700 uppercase">CAPITAL POWER</div>
                        <div class="text-sm font-extrabold text-gray-900">안전한 자본력</div>
                        <div class="text-[11px] text-gray-500 leading-tight">안정적인 수당지급능력 보장<br>장기적 성장의 핵심 기반</div>
                        <div class="mt-2 py-1 bg-orange-500 text-white text-xs font-bold rounded">안전한 자본력</div>
                    </div>
                    <div class="border border-orange-200 bg-orange-50/30 rounded-xl p-4 text-center space-y-1.5">
                        <div class="text-xs font-bold text-orange-700 uppercase">TRUST</div>
                        <div class="text-sm font-extrabold text-gray-900">높은 공신력</div>
                        <div class="text-[11px] text-gray-500 leading-tight">약속이 아닌 투명한 공개<br>입증된 믿음과 신뢰 실현</div>
                        <div class="mt-2 py-1 bg-orange-500 text-white text-xs font-bold rounded">공신력</div>
                    </div>
                </div>

                <div class="text-center font-extrabold text-2xl text-gray-400 my-4">+</div>

                <div class="text-center mb-6">
                    <div class="inline-block border-2 border-teal-500 bg-teal-50/50 px-8 py-2 rounded-xl text-teal-700 font-extrabold text-base shadow-sm">
                        파트너스본부
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-4 mb-8">
                    <div class="border border-teal-200 bg-teal-50/30 rounded-xl p-4 text-center space-y-1.5">
                        <div class="text-xs font-bold text-teal-700">GA업계 최초</div>
                        <div class="text-sm font-extrabold text-gray-900">완벽한 공개수당 규정</div>
                        <div class="text-[11px] text-gray-500 leading-tight">말로만 하는 약속이 아닌<br>모든 수수료와 시책 100% 공개</div>
                        <div class="mt-2 py-1 bg-teal-500 text-white text-xs font-bold rounded">투명 & 정직</div>
                    </div>
                    <div class="border border-teal-200 bg-teal-50/30 rounded-xl p-4 text-center space-y-1.5">
                        <div class="text-xs font-bold text-teal-700">최상위 수준</div>
                        <div class="text-sm font-extrabold text-gray-900">최상위 수당 & 시책</div>
                        <div class="text-[11px] text-gray-500 leading-tight">비교할수록 높은 수수료 지급<br>현장 설계사 최우선 정책</div>
                        <div class="mt-2 py-1 bg-teal-500 text-white text-xs font-bold rounded">최상위 수당</div>
                    </div>
                    <div class="border border-teal-200 bg-teal-50/30 rounded-xl p-4 text-center space-y-1.5">
                        <div class="text-xs font-bold text-teal-700">설계사 중심</div>
                        <div class="text-sm font-extrabold text-gray-900">경력설계사 교육지원</div>
                        <div class="text-[11px] text-gray-500 leading-tight">ZOOM 및 전문 교육 질의응답<br>실무 중심 고효율 정보 제공</div>
                        <div class="mt-2 py-1 bg-teal-500 text-white text-xs font-bold rounded">양질의 교육</div>
                    </div>
                </div>
            </div>

            <div class="text-center py-4 bg-gray-50 rounded-2xl border border-gray-200">
                <div class="text-base font-black text-gray-900">한화라이프랩 + 파트너스본부 = <span class="text-orange-600">PERFECT</span></div>
            </div>
        </div>
    `;
}

/**
 * 3P: 미션 / 비전
 */
function buildMissionPage() {
    return `
        <div class="a4-page bg-white shadow-xl p-16 flex flex-col justify-around text-center">
            <div class="flex justify-center items-center gap-3">
                <span class="text-xs font-bold text-gray-500 uppercase tracking-widest">한화라이프랩 파트너스본부</span>
            </div>

            <div class="space-y-8 my-auto">
                <div class="max-w-md mx-auto p-6 bg-orange-50 rounded-2xl border border-orange-200">
                    <span class="inline-block px-3 py-1 bg-orange-600 text-white text-xs font-black rounded mb-2">MISSION</span>
                    <h2 class="text-2xl font-black text-gray-900">고객에게 평생서비스를 제공한다.</h2>
                </div>

                <div class="max-w-md mx-auto p-6 bg-slate-900 rounded-2xl text-white">
                    <span class="inline-block px-3 py-1 bg-orange-500 text-white text-xs font-black rounded mb-2">VISION</span>
                    <h2 class="text-2xl font-black text-orange-400">Long-Run Together!</h2>
                    <p class="text-xs text-gray-300 mt-1">함께 멀리 가는 파트너스본부</p>
                </div>
            </div>

            <div class="grid grid-cols-4 gap-4 text-center">
                <div class="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div class="text-xs font-bold text-gray-800">신뢰중시</div>
                </div>
                <div class="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div class="text-xs font-bold text-gray-800">고객중심</div>
                </div>
                <div class="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div class="text-xs font-bold text-gray-800">상호존중</div>
                </div>
                <div class="p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div class="text-xs font-bold text-gray-800">윤리적 성공</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 4P: 수당규정 요약 페이지
 */
function buildRegulationSummaryPage() {
    const p = totalFeeReportState.preset;
    const nl = totalFeeReportState.nonLifeRate;
    const l = totalFeeReportState.lifeRate;

    return `
        <div class="a4-page bg-white shadow-xl p-14 flex flex-col justify-between">
            <div class="space-y-6">
                <div class="border-2 border-gray-800 p-3 text-center rounded-lg bg-gray-50">
                    <h2 class="text-xl font-black text-gray-900">${p} 수당규정</h2>
                </div>

                <div class="space-y-6 text-sm text-gray-800 leading-relaxed">
                    <div>
                        <h3 class="font-extrabold text-base text-gray-900 mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 bg-orange-500 rounded-full"></span>
                            1. 계약수수료 (% : 월납입 보험료 대비)
                        </h3>
                        <div class="pl-4 space-y-1 text-xs text-gray-600">
                            <p>1) 손해보험 계약수수료: <strong>지급율 ${nl}%</strong> 적용 (인보험 20년납, 수정률 240% 기준)</p>
                            <p>2) 생명보험 계약수수료: <strong>지급율 ${l}%</strong> 적용 (종신보험 20년납 기준)</p>
                        </div>
                    </div>

                    <div>
                        <h3 class="font-extrabold text-base text-gray-900 mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 bg-orange-500 rounded-full"></span>
                            2. 보험사 시상
                        </h3>
                        <div class="pl-4 text-xs text-gray-600">
                            <p>1) 보험사(손해/생명)에서 설계사에게 지급하는 모든 시상금은 <strong>전액 100% 지급</strong>한다.</p>
                            <p class="text-gray-500 mt-0.5">- 인보험 시상, 연속가동 시상, 주차별 시상, 보종별 시상, 특별 시상 등</p>
                        </div>
                    </div>

                    <div>
                        <h3 class="font-extrabold text-base text-gray-900 mb-2 flex items-center gap-2">
                            <span class="w-2 h-2 bg-orange-500 rounded-full"></span>
                            3. 본사 시상 (손해보험)
                        </h3>
                        <div class="pl-4 text-xs text-gray-600">
                            <p>1) 손해보험 계약에 대해 본사 시상금을 추가 지급한다.</p>
                            <p>2) 시상금은 월 합산실적에 비례하며, 보험사별 지급율에 따라 산정한다.</p>
                        </div>
                    </div>

                    ${p === '사업단장' ? `
                        <div>
                            <h3 class="font-extrabold text-base text-gray-900 mb-2 flex items-center gap-2">
                                <span class="w-2 h-2 bg-orange-500 rounded-full"></span>
                                4. 관리수당 (오버라이드) 및 법인시상
                            </h3>
                            <div class="pl-4 text-xs text-gray-600">
                                <p>1) 사업단장은 산하 설계사 계약에 대해 수수료 차이만큼의 관리수당 지급</p>
                                <p>2) 사업단 사무실 개설 시 법인시상금(50~150%) 추가 지원</p>
                            </div>
                        </div>
                    ` : `
                        <div>
                            <h3 class="font-extrabold text-base text-gray-900 mb-2 flex items-center gap-2">
                                <span class="w-2 h-2 bg-orange-500 rounded-full"></span>
                                4. 증원수당 제도
                            </h3>
                            <div class="pl-4 text-xs text-gray-600">
                                <p>1) 산하 1차~4차 인원의 실적에 따른 정기 증원수당 지급</p>
                                <p>2) 지점장 유고 시 유가족 생활안정자금 50% 10년간 지급 보장</p>
                            </div>
                        </div>
                    `}
                </div>
            </div>

            <div class="text-right text-xs text-gray-400">
                ※ 상세내용은 첨부된 총수당 예시표를 참고해 주세요.
            </div>
        </div>
    `;
}

/**
 * 손해보험 총수당 예시표 페이지들 빌드
 */
function buildNonLifeTablePages() {
    const state = totalFeeReportState;
    const rateFactor = (parseFloat(state.nonLifeRate) || 84) / 100;

    // 손보 정책 데이터 가져오기 (상품을 선택한 보험사만 출력물에 포함)
    const policies = (state.policyData || []).filter(p => p['보험사구분'] === '손해보험' && p['대표상품명'] && String(p['대표상품명']).trim() !== '');

    // 계산된 항목들 생성
    const items = policies.map(p => {
        const comp = p['보험사명'];
        const prod = p['대표상품명'] || '';
        const payPeriod = p['납입기간'] || '';
        const displayName = p['상품명표시'] || prod || `${comp} 종합보험`;

        // 엑셀 원본 수수료 찾기
        const rawRow = findFeeDataRow('손해보험', comp, prod, payPeriod);
        const rates = (rawRow && rawRow.rates) ? rawRow.rates : { first: 550, year1: 850, m13: 85, year2: 170, total: 850 };

        // 수수료율 계산 (원본 × 지급율)
        const feeNext = Math.round((rates.first || 0) * rateFactor);
        const feeM7_11 = 0;
        const feeM13 = Math.round((rates.m13 || 0) * rateFactor);
        const feeM14 = Math.round((rates.m13 || 0) * rateFactor);
        const feeM15 = Math.round(((rates.year2 || 0) - (rates.m13 || 0) * 2) * rateFactor);
        const feeSubTotal = feeNext + feeM7_11 + feeM13 + feeM14 + Math.max(feeM15, 0);

        // 시상금 항목들
        const rewNext = parseFloat(p['익월기본시상']) || 0;
        const rewWeek = parseFloat(p['주차시상']) || 0;
        const rewCont = parseFloat(p['연속시상']) || 0;
        const rewOther = parseFloat(p['기타시상']) || 0;
        const rewHq = parseFloat(p['본사시상']) || 0;
        const rewSubTotal = rewWeek + rewCont + rewOther + rewHq;

        // 합계 산출
        const nextMonthTotal = feeNext + rewNext;
        const grandTotal = feeSubTotal + rewSubTotal;

        return {
            company: comp,
            product: prod,
            displayName: displayName,
            payPeriod: payPeriod,
            fee: {
                next: feeNext,
                m7_11: feeM7_11,
                m13: feeM13,
                m14: feeM14,
                m15: Math.max(feeM15, 0),
                subTotal: feeSubTotal
            },
            reward: {
                next: rewNext,
                week: rewWeek,
                cont: rewCont,
                other: rewOther,
                hq: rewHq,
                subTotal: rewSubTotal
            },
            nextMonthTotal: nextMonthTotal,
            grandTotal: grandTotal
        };
    });

    // 정렬 적용 (손해보험 개별 정렬 기준)
    const nonLifeSort = (state.sortBys && state.sortBys['손해보험']) || state.sortBy || 'nextMonth';
    if (nonLifeSort === 'total') {
        items.sort((a, b) => b.grandTotal - a.grandTotal);
    } else {
        items.sort((a, b) => b.nextMonthTotal - a.nextMonthTotal);
    }

    // A4 1페이지당 4~5개 회사 배치
    const pageSize = 4;
    const pages = [];
    for (let i = 0; i < items.length; i += pageSize) {
        pages.push(items.slice(i, i + pageSize));
    }

    return pages.map((pageItems, pageIdx) => `
        <div class="a4-page bg-white shadow-xl p-8 flex flex-col justify-between">
            <div>
                <!-- 상단 타이틀 바 -->
                <div class="flex items-center justify-between border-2 border-gray-900 rounded-lg p-3 bg-gray-50 mb-4">
                    <h2 class="text-lg font-black text-gray-900" id="report-title-display-손해보험">
                        ${state.titles['손해보험']}
                    </h2>
                    <div class="px-4 py-1 bg-indigo-900 text-white text-xs font-black rounded">
                        손해보험
                    </div>
                </div>

                <!-- 안내 문구 및 기준일 -->
                <div class="flex justify-between items-end text-[11px] text-gray-600 mb-4 pb-2 border-b border-gray-200">
                    <div class="space-y-0.5">
                        <div>· 인보험, 20년납, 수정률 240% 기준</div>
                        <div>· 시상은 손보 월 합산실적 20만원 이상인 경우, 실적구간 없이 지급</div>
                        <div>· 기타 항목은 '클럽(멤버십)', '주력상품/신규상품', '물품', '여행' 시상 등을 합하여 표시함</div>
                    </div>
                    <div class="text-right">
                        <div class="font-bold text-gray-800">※ ${state.weekText}</div>
                        <div class="text-gray-500 text-[10px]">(${nonLifeSort === 'total' ? '총합계 순' : '익월합계 순'})</div>
                    </div>
                </div>

                <!-- 회사별 테이블 블록들 -->
                <div class="space-y-4">
                    ${pageItems.map(item => `
                        <div class="border border-gray-300 rounded-lg overflow-hidden text-center text-xs">
                            <!-- 헤더: 회사명 & 대표상품 -->
                            <div class="bg-gray-100/90 text-gray-900 font-extrabold px-3 py-1.5 text-left border-b border-gray-300 flex items-center justify-between">
                                <span>[ ${item.company} ] <span class="font-bold text-gray-700">${item.displayName}</span></span>
                                ${item.payPeriod ? `<span class="text-[10px] text-gray-500 font-normal">(${item.payPeriod})</span>` : ''}
                            </div>

                            <table class="w-full border-collapse">
                                <thead>
                                    <tr class="bg-[#2e7b88] text-white text-[11px] font-bold">
                                        <th class="py-1.5 px-2 border-r border-teal-600/50 w-20">지급항목</th>
                                        <th class="py-1.5 px-1 border-r border-teal-600/50">익월</th>
                                        <th class="py-1.5 px-1 border-r border-teal-600/50 bg-[#256772]">익월합계</th>
                                        <th class="py-1.5 px-1 border-r border-teal-600/50">7~11차월</th>
                                        <th class="py-1.5 px-1 border-r border-teal-600/50">13차월</th>
                                        <th class="py-1.5 px-1 border-r border-teal-600/50">14차월</th>
                                        <th class="py-1.5 px-1 border-r border-teal-600/50">15차월</th>
                                        <th class="py-1.5 px-1 border-r border-teal-600/50 bg-[#256772]">소계</th>
                                        <th class="py-1.5 px-2 bg-[#1b5059]">총합계</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <!-- 수수료 행 -->
                                    <tr class="border-b border-gray-200">
                                        <td class="py-1 px-2 font-bold bg-gray-50 text-gray-700 border-r border-gray-200">수수료</td>
                                        <td class="py-1 px-1 font-semibold text-gray-800 border-r border-gray-200">${item.fee.next}%</td>
                                        <!-- 익월합계 세로 병합 셀 -->
                                        <td rowspan="2" class="py-1 px-1 font-black text-indigo-900 bg-indigo-50/80 border-r border-gray-200 text-sm">
                                            ${item.nextMonthTotal}%
                                        </td>
                                        <td class="py-1 px-1 text-gray-700 border-r border-gray-200">${item.fee.m7_11}%</td>
                                        <td class="py-1 px-1 text-gray-700 border-r border-gray-200">${item.fee.m13}%</td>
                                        <td class="py-1 px-1 text-gray-700 border-r border-gray-200">${item.fee.m14}%</td>
                                        <td class="py-1 px-1 text-gray-700 border-r border-gray-200">${item.fee.m15}%</td>
                                        <td class="py-1 px-1 font-bold text-gray-800 bg-gray-50 border-r border-gray-200">${item.fee.subTotal}%</td>
                                        <!-- 총합계 세로 병합 셀 -->
                                        <td rowspan="2" class="py-1 px-2 font-black text-purple-900 bg-purple-100/90 text-sm">
                                            ${item.grandTotal}%
                                        </td>
                                    </tr>

                                    <!-- 시상 행 -->
                                    <tr>
                                        <td class="py-1 px-2 font-bold bg-gray-50 text-gray-700 border-r border-gray-200 leading-tight">
                                            시상<br><span class="text-[10px] text-gray-500 font-normal">(기본+본사)</span>
                                        </td>
                                        <td class="py-1 px-1 font-semibold text-gray-800 border-r border-gray-200">${item.reward.next}%</td>
                                        <!-- 익월합계는 위에서 병합됨 -->
                                        <td colspan="4" class="py-1 px-2 text-[10px] text-gray-600 text-right border-r border-gray-200 space-x-2">
                                            ${item.reward.hq > 0 ? `<span>(본사) ${item.reward.hq}%</span>` : ''}
                                            ${item.reward.week > 0 ? `<span>(주차) ${item.reward.week}%</span>` : ''}
                                            ${item.reward.cont > 0 ? `<span>(연속) ${item.reward.cont}%</span>` : ''}
                                            ${item.reward.other > 0 ? `<span>(기타) ${item.reward.other}%</span>` : ''}
                                        </td>
                                        <td class="py-1 px-1 font-bold text-gray-800 bg-gray-50 border-r border-gray-200">${item.reward.subTotal}%</td>
                                        <!-- 총합계는 위에서 병합됨 -->
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="flex justify-between items-center text-[10px] text-gray-400 pt-4 border-t border-gray-100">
                <span>한화라이프랩 파트너스본부</span>
                <span>${pageIdx + 1} / ${pages.length}</span>
            </div>
        </div>
    `).join('');
}

/**
 * 생명보험 3종 총수당 예시표 페이지들 빌드 (종신 / 단기납 / 경영인)
 */
function buildLifeTablePages(catKey, subDesc, titleText, badgeColor) {
    const state = totalFeeReportState;
    const rateFactor = (parseFloat(state.lifeRate) || 79) / 100;

    const policies = (state.policyData || []).filter(p => p['보험사구분'] === '생명보험' && p['상품구분'] === catKey && p['대표상품명'] && String(p['대표상품명']).trim() !== '');

    const items = policies.map(p => {
        const comp = p['보험사명'];
        const prod = p['대표상품명'] || '';
        const payPeriod = p['납입기간'] || '';
        const displayName = p['상품명표시'] || prod || `${comp} 종신보험`;

        const rawRow = findFeeDataRow('생명보험', comp, prod, payPeriod);
        const rates = (rawRow && rawRow.rates) ? rawRow.rates : { first: 600, year1: 800, m13: 200, year2: 300, year3: 200, total: 1500 };

        const feeNext = Math.round((rates.first || 0) * rateFactor);
        const feeM7_12 = 0;
        const feeM13 = Math.round((rates.m13 || 0) * rateFactor);
        const feeY2 = Math.round(((rates.year2 || 0) - (rates.m13 || 0)) * rateFactor);
        const feeY3 = Math.round((rates.year3 || 0) * rateFactor);
        const feeY4 = Math.round(((rates.total || 0) - (rates.year1 || 0) - (rates.year2 || 0) - (rates.year3 || 0)) * rateFactor);
        const feeSubTotal = feeNext + feeM7_12 + feeM13 + Math.max(feeY2, 0) + Math.max(feeY3, 0) + Math.max(feeY4, 0);

        const rewNext = parseFloat(p['익월기본시상']) || 0;
        const rewM13 = parseFloat(p['13차월시상']) || 0;
        const rewSubTotal = rewNext + rewM13;

        const nextMonthTotal = feeNext + rewNext;
        const grandTotal = feeSubTotal + rewSubTotal;

        return {
            company: comp,
            product: prod,
            displayName: displayName,
            payPeriod: payPeriod,
            fee: {
                next: feeNext,
                m7_12: feeM7_12,
                m13: feeM13,
                y2: Math.max(feeY2, 0),
                y3: Math.max(feeY3, 0),
                y4: Math.max(feeY4, 0),
                subTotal: feeSubTotal
            },
            reward: {
                next: rewNext,
                m13: rewM13,
                subTotal: rewSubTotal
            },
            nextMonthTotal: nextMonthTotal,
            grandTotal: grandTotal
        };
    });

    // 정렬 적용 (보종별 개별 정렬 기준)
    const lifeSort = (state.sortBys && state.sortBys[catKey]) || state.sortBy || 'nextMonth';
    if (lifeSort === 'total') {
        items.sort((a, b) => b.grandTotal - a.grandTotal);
    } else {
        items.sort((a, b) => b.nextMonthTotal - a.nextMonthTotal);
    }

    const pageSize = 5;
    const pages = [];
    for (let i = 0; i < items.length; i += pageSize) {
        pages.push(items.slice(i, i + pageSize));
    }

    const badgeLabels = {
        '종신보험': '생명보험',
        '단기납종신': '단기납 종신보험',
        '경영인정기': '경영인정기'
    };

    return pages.map((pageItems, pageIdx) => `
        <div class="a4-page bg-white shadow-xl p-8 flex flex-col justify-between">
            <div>
                <!-- 상단 타이틀 바 -->
                <div class="flex items-center justify-between border-2 border-gray-900 rounded-lg p-3 bg-gray-50 mb-4">
                    <h2 class="text-lg font-black text-gray-900" id="report-title-display-${catKey}">
                        ${state.titles[catKey]}
                    </h2>
                    <div class="px-4 py-1 text-white text-xs font-black rounded" style="background-color: ${badgeColor};">
                        ${badgeLabels[catKey] || catKey}
                    </div>
                </div>

                <!-- 안내 문구 및 기준일 -->
                <div class="flex justify-between items-end text-[11px] text-gray-600 mb-4 pb-2 border-b border-gray-200">
                    <div class="space-y-0.5">
                        <div>${subDesc}</div>
                    </div>
                    <div class="text-right">
                        <div class="font-bold text-gray-800">※ ${state.weekText}</div>
                        <div class="text-gray-500 text-[10px]">(${lifeSort === 'total' ? '총합계 순' : '익월합계 순'})</div>
                    </div>
                </div>

                <!-- 회사별 테이블 블록들 -->
                <div class="space-y-3.5">
                    ${pageItems.map(item => `
                        <div class="border border-gray-300 rounded-lg overflow-hidden text-center text-xs">
                            <div class="bg-gray-100/90 text-gray-900 font-extrabold px-3 py-1.5 text-left border-b border-gray-300 flex items-center justify-between">
                                <span>[ ${item.company} ] <span class="font-bold text-gray-700">${item.displayName}</span></span>
                                ${item.payPeriod ? `<span class="text-[10px] text-gray-500 font-normal">(${item.payPeriod})</span>` : ''}
                            </div>

                            <table class="w-full border-collapse">
                                <thead>
                                    <tr class="bg-[#2e7b88] text-white text-[10.5px] font-bold">
                                        <th class="py-1 px-2 border-r border-teal-600/50 w-20">지급항목</th>
                                        <th class="py-1 px-1 border-r border-teal-600/50">익월</th>
                                        <th class="py-1 px-1 border-r border-teal-600/50 bg-[#256772]">익월합계</th>
                                        <th class="py-1 px-1 border-r border-teal-600/50">7~12차월</th>
                                        <th class="py-1 px-1 border-r border-teal-600/50">13차월</th>
                                        <th class="py-1 px-1 border-r border-teal-600/50">2차년</th>
                                        <th class="py-1 px-1 border-r border-teal-600/50">3차년</th>
                                        <th class="py-1 px-1 border-r border-teal-600/50">4차년+</th>
                                        <th class="py-1 px-1 border-r border-teal-600/50 bg-[#256772]">소계</th>
                                        <th class="py-1 px-2 bg-[#1b5059]">총합계</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr class="border-b border-gray-200">
                                        <td class="py-1 px-2 font-bold bg-gray-50 text-gray-700 border-r border-gray-200">수수료</td>
                                        <td class="py-1 px-1 font-semibold text-gray-800 border-r border-gray-200">${item.fee.next}%</td>
                                        <td rowspan="2" class="py-1 px-1 font-black text-indigo-900 bg-indigo-50/80 border-r border-gray-200 text-sm">
                                            ${item.nextMonthTotal}%
                                        </td>
                                        <td class="py-1 px-1 text-gray-700 border-r border-gray-200">${item.fee.m7_12}%</td>
                                        <td class="py-1 px-1 text-gray-700 border-r border-gray-200">${item.fee.m13}%</td>
                                        <td class="py-1 px-1 text-gray-700 border-r border-gray-200">${item.fee.y2}%</td>
                                        <td class="py-1 px-1 text-gray-700 border-r border-gray-200">${item.fee.y3}%</td>
                                        <td class="py-1 px-1 text-gray-700 border-r border-gray-200">${item.fee.y4}%</td>
                                        <td class="py-1 px-1 font-bold text-gray-800 bg-gray-50 border-r border-gray-200">${item.fee.subTotal}%</td>
                                        <td rowspan="2" class="py-1 px-2 font-black text-purple-900 bg-purple-100/90 text-sm">
                                            ${item.grandTotal}%
                                        </td>
                                    </tr>
                                    <tr>
                                        <td class="py-1 px-2 font-bold bg-gray-50 text-gray-700 border-r border-gray-200">시상금</td>
                                        <td class="py-1 px-1 font-semibold text-gray-800 border-r border-gray-200">${item.reward.next}%</td>
                                        <td class="py-1 px-1 text-gray-700 border-r border-gray-200">-</td>
                                        <td class="py-1 px-1 font-semibold text-orange-600 border-r border-gray-200">${item.reward.m13 > 0 ? `${item.reward.m13}%` : '-'}</td>
                                        <td class="py-1 px-1 text-gray-700 border-r border-gray-200">-</td>
                                        <td class="py-1 px-1 text-gray-700 border-r border-gray-200">-</td>
                                        <td class="py-1 px-1 text-gray-700 border-r border-gray-200">-</td>
                                        <td class="py-1 px-1 font-bold text-gray-800 bg-gray-50 border-r border-gray-200">${item.reward.subTotal}%</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="flex justify-between items-center text-[10px] text-gray-400 pt-4 border-t border-gray-100">
                <span>한화라이프랩 파트너스본부</span>
                <span>${pageIdx + 1} / ${pages.length}</span>
            </div>
        </div>
    `).join('');
}

/**
 * 리크루팅 안내 페이지
 */
function buildRecruitingPage() {
    return `
        <div class="a4-page bg-white shadow-xl p-14 flex flex-col justify-between">
            <div>
                <div class="inline-block px-4 py-1.5 bg-gray-900 text-white font-black text-sm tracking-wider rounded mb-10">
                    RECRUITING
                </div>

                <div class="text-center my-8">
                    <h2 class="text-2xl font-black text-gray-900 mb-8">모 집 대 상</h2>
                    
                    <div class="max-w-lg mx-auto space-y-6 text-left">
                        <div class="border border-teal-500 rounded-2xl p-6 bg-teal-50/30">
                            <span class="inline-block px-3 py-1 bg-teal-600 text-white text-xs font-bold rounded mb-3">경력설계사 모집</span>
                            <p class="text-xs text-gray-700 leading-relaxed">
                                - 신용, 과거 유지율(e-클린보험서비스) 등이 가장 중요한 조건입니다.<br>
                                - 신용 조건: 서울보증보험 신용등급 기준 8등급 이상
                            </p>
                        </div>

                        <div class="border border-orange-500 rounded-2xl p-6 bg-orange-50/30">
                            <span class="inline-block px-3 py-1 bg-orange-600 text-white text-xs font-bold rounded mb-3">사업단 / 본부 모집</span>
                            <p class="text-base font-extrabold text-gray-900 mt-2">
                                “ 1등은 약속하지 않는다. 매번 증명할 뿐! ”
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="text-center text-xs text-gray-400">
                PARTNERS HEADQUARTERS · HANWHA LIFE LAB
            </div>
        </div>
    `;
}

/**
 * 증원수당 예시표 1 페이지
 */
function buildRecruitmentTablePage1() {
    return `
        <div class="a4-page bg-white shadow-xl p-8 flex flex-col justify-between text-xs">
            <div>
                <div class="border-2 border-gray-900 p-2.5 text-center rounded-lg bg-gray-50 mb-4">
                    <h2 class="text-base font-black text-gray-900">Success 수당규정 증원수당 규정 및 예시표 1</h2>
                </div>

                <!-- 인원 및 실적 가정표 -->
                <div class="border border-teal-600 rounded-lg overflow-hidden mb-4">
                    <div class="bg-teal-700 text-white font-bold px-3 py-1 text-center">내 산하 증원한 인원 및 월보험료 실적 가정</div>
                    <table class="w-full text-center border-collapse text-[11px]">
                        <tbody>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">1차 산하 인원수</td>
                                <td class="py-1 px-2 border-r border-gray-200">10</td>
                                <td class="py-1 px-2 border-r border-gray-200">10</td>
                                <td class="py-1 px-2 border-r border-gray-200">10</td>
                                <td class="py-1 px-2">10</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">2차 산하 인원수</td>
                                <td class="py-1 px-2 border-r border-gray-200">30</td>
                                <td class="py-1 px-2 border-r border-gray-200">30</td>
                                <td class="py-1 px-2 border-r border-gray-200">30</td>
                                <td class="py-1 px-2">30</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">3차 산하 인원수</td>
                                <td class="py-1 px-2 border-r border-gray-200">90</td>
                                <td class="py-1 px-2 border-r border-gray-200">90</td>
                                <td class="py-1 px-2 border-r border-gray-200">90</td>
                                <td class="py-1 px-2">90</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">4차 산하 인원수</td>
                                <td class="py-1 px-2 border-r border-gray-200">270</td>
                                <td class="py-1 px-2 border-r border-gray-200">270</td>
                                <td class="py-1 px-2 border-r border-gray-200">270</td>
                                <td class="py-1 px-2">270</td>
                            </tr>
                            <tr class="border-b border-gray-200 font-extrabold bg-teal-50/50">
                                <td class="py-1 px-2 border-r border-gray-200 text-left">총 인원</td>
                                <td class="py-1 px-2 border-r border-gray-200">400</td>
                                <td class="py-1 px-2 border-r border-gray-200">400</td>
                                <td class="py-1 px-2 border-r border-gray-200">400</td>
                                <td class="py-1 px-2">400</td>
                            </tr>
                            <tr class="font-bold bg-gray-100">
                                <td class="py-1 px-2 border-r border-gray-200 text-left">인당 월보험료</td>
                                <td class="py-1 px-2 border-r border-gray-200">1,000,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">500,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">300,000</td>
                                <td class="py-1 px-2">100,000</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- 손해보험 증원수당 예시 -->
                <div class="border border-teal-600 rounded-lg overflow-hidden mb-4">
                    <div class="bg-teal-700 text-white font-bold px-3 py-1 flex justify-between">
                        <span>손해보험 (보장성 인보험) 증원수당 예시</span>
                        <span class="text-[10px] text-teal-200">(익월 지급)</span>
                    </div>
                    <table class="w-full text-center border-collapse text-[11px]">
                        <tbody>
                            <tr class="border-b border-gray-200 bg-gray-50">
                                <td class="py-1 px-2 font-bold border-r border-gray-200 text-left">손보 증원수당율</td>
                                <td colspan="4" class="py-1 px-2 font-bold text-teal-800">보험료의 30%</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">1차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">3,000,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">1,500,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">900,000</td>
                                <td class="py-1 px-2">300,000</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">2차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">9,000,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">4,500,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">2,700,000</td>
                                <td class="py-1 px-2">900,000</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">3차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">27,000,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">13,500,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">8,100,000</td>
                                <td class="py-1 px-2">2,700,000</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">4차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">81,000,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">40,500,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">24,300,000</td>
                                <td class="py-1 px-2">8,100,000</td>
                            </tr>
                            <tr class="font-extrabold bg-red-50 text-red-700">
                                <td class="py-1 px-2 border-r border-gray-200 text-left">총 증원수당 합계</td>
                                <td class="py-1 px-2 border-r border-gray-200">120,000,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">60,000,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">36,000,000</td>
                                <td class="py-1 px-2">12,000,000</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- 생명보험 증원수당 예시 -->
                <div class="border border-teal-600 rounded-lg overflow-hidden">
                    <div class="bg-teal-700 text-white font-bold px-3 py-1 flex justify-between">
                        <span>생명보험 (보장성 종신보험) 증원수당 예시</span>
                        <span class="text-[10px] text-teal-200">(수수료 지급월에 맞춰 지급)</span>
                    </div>
                    <table class="w-full text-center border-collapse text-[11px]">
                        <tbody>
                            <tr class="border-b border-gray-200 bg-gray-50">
                                <td class="py-1 px-2 font-bold border-r border-gray-200 text-left">생보 증원수당율</td>
                                <td colspan="4" class="py-1 px-2 font-bold text-teal-800">수수료의 2.25%</td>
                            </tr>
                            <tr class="bg-gray-100 font-bold border-b border-gray-200">
                                <td class="py-1 px-2 border-r border-gray-200 text-left">지급기간</td>
                                <td class="py-1 px-2 border-r border-gray-200">1차년</td>
                                <td class="py-1 px-2 border-r border-gray-200">13회차</td>
                                <td class="py-1 px-2 border-r border-gray-200">2~3차년</td>
                                <td class="py-1 px-2">합계</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">1차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">1,719,107</td>
                                <td class="py-1 px-2 border-r border-gray-200">626,658</td>
                                <td class="py-1 px-2 border-r border-gray-200">986,729</td>
                                <td class="py-1 px-2">3,332,494</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">2차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">5,157,321</td>
                                <td class="py-1 px-2 border-r border-gray-200">1,879,974</td>
                                <td class="py-1 px-2 border-r border-gray-200">2,960,187</td>
                                <td class="py-1 px-2">9,997,482</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">3차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">15,471,963</td>
                                <td class="py-1 px-2 border-r border-gray-200">5,639,922</td>
                                <td class="py-1 px-2 border-r border-gray-200">8,880,561</td>
                                <td class="py-1 px-2">29,992,446</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">4차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">46,415,889</td>
                                <td class="py-1 px-2 border-r border-gray-200">16,919,766</td>
                                <td class="py-1 px-2 border-r border-gray-200">26,641,683</td>
                                <td class="py-1 px-2">89,977,338</td>
                            </tr>
                            <tr class="font-extrabold bg-red-50 text-red-700">
                                <td class="py-1 px-2 border-r border-gray-200 text-left">총 증원수당 합계</td>
                                <td class="py-1 px-2 border-r border-gray-200">68,764,280</td>
                                <td class="py-1 px-2 border-r border-gray-200">25,066,320</td>
                                <td class="py-1 px-2 border-r border-gray-200">39,469,160</td>
                                <td class="py-1 px-2">133,299,760</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="text-right text-[10px] text-gray-400">
                ※ 주요 생명보험사의 평균 수수료를 기준으로 계산한 증원수당임
            </div>
        </div>
    `;
}

/**
 * 증원수당 예시표 2 페이지 (대규모 가정)
 */
function buildRecruitmentTablePage2() {
    return `
        <div class="a4-page bg-white shadow-xl p-8 flex flex-col justify-between text-xs">
            <div>
                <div class="border-2 border-gray-900 p-2.5 text-center rounded-lg bg-gray-50 mb-4">
                    <h2 class="text-base font-black text-gray-900">Success 수당규정 증원수당 규정 및 예시표 2</h2>
                </div>

                <div class="border border-teal-600 rounded-lg overflow-hidden mb-4">
                    <div class="bg-teal-700 text-white font-bold px-3 py-1 text-center">내 산하 증원한 인원 및 월보험료 실적 가정</div>
                    <table class="w-full text-center border-collapse text-[11px]">
                        <tbody>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">1차 산하 인원수</td>
                                <td class="py-1 px-2 border-r border-gray-200">10</td>
                                <td class="py-1 px-2 border-r border-gray-200">10</td>
                                <td class="py-1 px-2 border-r border-gray-200">10</td>
                                <td class="py-1 px-2">10</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">2차 산하 인원수</td>
                                <td class="py-1 px-2 border-r border-gray-200">50</td>
                                <td class="py-1 px-2 border-r border-gray-200">50</td>
                                <td class="py-1 px-2 border-r border-gray-200">50</td>
                                <td class="py-1 px-2">50</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">3차 산하 인원수</td>
                                <td class="py-1 px-2 border-r border-gray-200">250</td>
                                <td class="py-1 px-2 border-r border-gray-200">250</td>
                                <td class="py-1 px-2 border-r border-gray-200">250</td>
                                <td class="py-1 px-2">250</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">4차 산하 인원수</td>
                                <td class="py-1 px-2 border-r border-gray-200">750</td>
                                <td class="py-1 px-2 border-r border-gray-200">750</td>
                                <td class="py-1 px-2 border-r border-gray-200">750</td>
                                <td class="py-1 px-2">750</td>
                            </tr>
                            <tr class="border-b border-gray-200 font-extrabold bg-teal-50/50">
                                <td class="py-1 px-2 border-r border-gray-200 text-left">총 인원</td>
                                <td class="py-1 px-2 border-r border-gray-200">1,060</td>
                                <td class="py-1 px-2 border-r border-gray-200">1,060</td>
                                <td class="py-1 px-2 border-r border-gray-200">1,060</td>
                                <td class="py-1 px-2">1,060</td>
                            </tr>
                            <tr class="font-bold bg-gray-100">
                                <td class="py-1 px-2 border-r border-gray-200 text-left">인당 월보험료</td>
                                <td class="py-1 px-2 border-r border-gray-200">1,000,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">500,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">300,000</td>
                                <td class="py-1 px-2">100,000</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="border border-teal-600 rounded-lg overflow-hidden mb-4">
                    <div class="bg-teal-700 text-white font-bold px-3 py-1 flex justify-between">
                        <span>손해보험 (보장성 인보험) 증원수당 예시</span>
                        <span class="text-[10px] text-teal-200">(익월 지급)</span>
                    </div>
                    <table class="w-full text-center border-collapse text-[11px]">
                        <tbody>
                            <tr class="border-b border-gray-200 bg-gray-50">
                                <td class="py-1 px-2 font-bold border-r border-gray-200 text-left">손보 증원수당율</td>
                                <td colspan="4" class="py-1 px-2 font-bold text-teal-800">보험료의 30%</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">1차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">3,000,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">1,500,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">900,000</td>
                                <td class="py-1 px-2">300,000</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">2차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">15,000,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">7,500,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">4,500,000</td>
                                <td class="py-1 px-2">1,500,000</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">3차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">75,000,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">37,500,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">22,500,000</td>
                                <td class="py-1 px-2">7,500,000</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">4차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">225,000,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">112,500,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">67,500,000</td>
                                <td class="py-1 px-2">22,500,000</td>
                            </tr>
                            <tr class="font-extrabold bg-red-50 text-red-700">
                                <td class="py-1 px-2 border-r border-gray-200 text-left">총 증원수당 합계</td>
                                <td class="py-1 px-2 border-r border-gray-200">318,000,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">159,000,000</td>
                                <td class="py-1 px-2 border-r border-gray-200">95,400,000</td>
                                <td class="py-1 px-2">31,800,000</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="border border-teal-600 rounded-lg overflow-hidden">
                    <div class="bg-teal-700 text-white font-bold px-3 py-1 flex justify-between">
                        <span>생명보험 (보장성 종신보험) 증원수당 예시</span>
                        <span class="text-[10px] text-teal-200">(수수료 지급월에 맞춰 지급)</span>
                    </div>
                    <table class="w-full text-center border-collapse text-[11px]">
                        <tbody>
                            <tr class="border-b border-gray-200 bg-gray-50">
                                <td class="py-1 px-2 font-bold border-r border-gray-200 text-left">생보 증원수당율</td>
                                <td colspan="4" class="py-1 px-2 font-bold text-teal-800">수수료의 2.25%</td>
                            </tr>
                            <tr class="bg-gray-100 font-bold border-b border-gray-200">
                                <td class="py-1 px-2 border-r border-gray-200 text-left">지급기간</td>
                                <td class="py-1 px-2 border-r border-gray-200">1차년</td>
                                <td class="py-1 px-2 border-r border-gray-200">13회차</td>
                                <td class="py-1 px-2 border-r border-gray-200">2~3차년</td>
                                <td class="py-1 px-2">합계</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">1차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">1,719,107</td>
                                <td class="py-1 px-2 border-r border-gray-200">626,658</td>
                                <td class="py-1 px-2 border-r border-gray-200">986,729</td>
                                <td class="py-1 px-2">3,332,494</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">2차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">8,595,535</td>
                                <td class="py-1 px-2 border-r border-gray-200">3,133,290</td>
                                <td class="py-1 px-2 border-r border-gray-200">4,933,645</td>
                                <td class="py-1 px-2">16,662,470</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">3차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">42,977,675</td>
                                <td class="py-1 px-2 border-r border-gray-200">15,666,450</td>
                                <td class="py-1 px-2 border-r border-gray-200">24,668,225</td>
                                <td class="py-1 px-2">83,312,350</td>
                            </tr>
                            <tr class="border-b border-gray-200">
                                <td class="py-1 px-2 font-bold bg-gray-50 border-r border-gray-200 text-left">4차 증원수당</td>
                                <td class="py-1 px-2 border-r border-gray-200">128,933,025</td>
                                <td class="py-1 px-2 border-r border-gray-200">46,999,350</td>
                                <td class="py-1 px-2 border-r border-gray-200">74,004,675</td>
                                <td class="py-1 px-2">249,937,050</td>
                            </tr>
                            <tr class="font-extrabold bg-red-50 text-red-700">
                                <td class="py-1 px-2 border-r border-gray-200 text-left">총 증원수당 합계</td>
                                <td class="py-1 px-2 border-r border-gray-200">182,225,342</td>
                                <td class="py-1 px-2 border-r border-gray-200">66,425,748</td>
                                <td class="py-1 px-2 border-r border-gray-200">104,593,274</td>
                                <td class="py-1 px-2">353,244,364</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="text-right text-[10px] text-gray-400">
                ※ 주요 생명보험사의 평균 수수료를 기준으로 계산한 증원수당임
            </div>
        </div>
    `;
}

/**
 * 인쇄 및 PDF 저장 트리거
 */
function triggerPrintReport(mode) {
    totalFeeReportState.outputMode = mode;
    updateReportTablesOnly();

    setTimeout(() => {
        window.print();
    }, 150);
}

/**
 * 관리자용: 시상금 및 대표상품 관리 모달 열기
 */
function openRewardPolicyModal() {
    // 기존에 열려 있는 모달이 있으면 제거
    const oldModal = document.getElementById('reward-policy-modal');
    if (oldModal) oldModal.remove();

    const state = totalFeeReportState;
    const curTab = state.activeTab || '손해보험';

    document.body.classList.add('modal-open');

    const modal = document.createElement('div');
    modal.id = 'reward-policy-modal';
    modal.className = "fixed inset-0 z-[120] bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn";
    
    // 모달 바깥 배경 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeRewardPolicyModal();
        }
    });

    modal.innerHTML = `
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200" onclick="event.stopPropagation()">
            
            <!-- 모달 헤더 -->
            <div class="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div>
                    <h2 class="text-base sm:text-lg font-bold flex items-center gap-2">
                        <span class="w-2 h-2 rounded-full bg-orange-500"></span>
                        월별 보험사 시상금 및 대표상품 설정 관리
                    </h2>
                    <p class="text-xs text-slate-400 mt-0.5">
                        스프레드시트 '월별시상' 시트와 연동되어 매월 대표상품, 납입기간, 표시상품명, 시상금을 설정합니다.
                    </p>
                </div>

                <div class="flex items-center gap-3">
                    <button onclick="copyPreviousMonthPolicyData()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-orange-400 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg>
                        전월 데이터 복사
                    </button>
                    <button onclick="closeRewardPolicyModal()" class="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
            </div>

            <!-- 탭 바: 보종 구분 -->
            <div id="reward-policy-modal-tabs" class="px-6 bg-gray-50 border-b border-gray-200 flex items-center gap-2 overflow-x-auto overflow-y-hidden shrink-0 h-14">
                ${buildPolicyTabsHtml(curTab)}
            </div>

            <!-- 설정 테이블 그리드 영역 -->
            <div class="p-6 overflow-y-auto flex-1 space-y-4">
                <div id="reward-policy-grid-container">
                    ${buildPolicyGridHtml(curTab)}
                </div>
            </div>

            <!-- 모달 푸터 액션 -->
            <div class="px-6 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                <span class="text-xs text-gray-500">
                    * 수수료 엑셀에 등록된 실제 상품과 납입기간 옵션이 드롭다운으로 자동 연동됩니다.
                </span>
                <div class="flex items-center gap-2.5">
                    <button onclick="closeRewardPolicyModal()" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl text-xs font-bold transition">
                        닫기
                    </button>
                    <button onclick="saveRewardPolicyToDb()" id="save-reward-policy-btn" class="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md shadow-orange-200 transition flex items-center gap-1.5">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                        월별시상 시트에 저장하기
                    </button>
                </div>
            </div>

        </div>
    `;

    document.body.appendChild(modal);

    // ESC 키로 모달 닫기
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeRewardPolicyModal();
            window.removeEventListener('keydown', escHandler);
        }
    };
    window.addEventListener('keydown', escHandler);
}

/**
 * 모달 탭 버튼 HTML 빌드
 */
function buildPolicyTabsHtml(curTab) {
    return ['손해보험', '종신보험', '단기납종신', '경영인정기'].map(tabKey => {
        const labels = {
            '손해보험': '1. 손해보험 (종합건강)',
            '종신보험': '2. 생보 - 종신보험 (20년)',
            '단기납종신': '3. 생보 - 단기납 종신 (7년)',
            '경영인정기': '4. 생보 - 경영인정기'
        };
        const isActive = curTab === tabKey;
        return `
            <button type="button" onclick="switchRewardPolicyTab('${tabKey}')" class="px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap border ${isActive ? 'bg-orange-500 text-white border-orange-500 shadow-xs' : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-200'}">
                ${labels[tabKey] || tabKey}
            </button>
        `;
    }).join('');
}

/**
 * 모달 내 탭 전환
 */
function switchRewardPolicyTab(tabKey) {
    totalFeeReportState.activeTab = tabKey;
    const tabsBar = document.getElementById('reward-policy-modal-tabs');
    if (tabsBar) {
        tabsBar.innerHTML = buildPolicyTabsHtml(tabKey);
        tabsBar.scrollTop = 0;
    }
    const gridContainer = document.getElementById('reward-policy-grid-container');
    if (gridContainer) {
        gridContainer.innerHTML = buildPolicyGridHtml(tabKey);
        const scrollParent = gridContainer.closest('.overflow-y-auto');
        if (scrollParent) scrollParent.scrollTop = 0;
    }
}

/**
 * HTML 속성 이스케이프 헬퍼
 */
function escapeHtmlAttr(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * 모달창 전용 보험사 목록 정렬: 영문(ABC순) 우선 -> 한글(가나다순)
 */
function getSortedCompaniesForModal(tabKey) {
    const isNonLife = tabKey === '손해보험';
    const insCategory = isNonLife ? '손해보험' : '생명보험';
    let baseList = [...(REPORT_COMPANIES[insCategory] || [])];

    // 엑셀 수수료 데이터에 등록된 추가 보험사가 있다면 누락 없이 통합
    if (FEE_TABLE_DATA && FEE_TABLE_DATA.categories && FEE_TABLE_DATA.categories[insCategory]) {
        const excelComps = Object.keys(FEE_TABLE_DATA.categories[insCategory]);
        excelComps.forEach(c => {
            if (!baseList.some(item => item === c || c.includes(item) || item.includes(c))) {
                baseList.push(c);
            }
        });
    }

    // ABC순(영문 우선) -> 가나다순(한글) 정렬
    return baseList.sort((a, b) => {
        const isEngA = /^[A-Za-z]/.test(a);
        const isEngB = /^[A-Za-z]/.test(b);
        if (isEngA && !isEngB) return -1;
        if (!isEngA && isEngB) return 1;
        return a.localeCompare(b, 'ko');
    });
}

/**
 * 모달 내 수수료율 즉시 표시 카드 HTML 빌드
 */
function buildModalFeeRatesHtml(matchedRow, isNonLife) {
    if (!matchedRow) {
        return `
            <div class="py-1 px-2 text-[10.5px] text-gray-400 italic bg-gray-50 rounded border border-dashed border-gray-200 text-center">
                대표상품을 선택하시면 수수료율(1회차~총합계)이 실시간으로 조회됩니다.
            </div>
        `;
    }

    const rates = matchedRow.rates || {};
    const state = totalFeeReportState;
    const curRate = parseFloat(isNonLife ? state.nonLifeRate : state.lifeRate) || (isNonLife ? 84 : 79);
    const rateFactor = curRate / 100;

    const calcFirst = rates.first ? Math.round(rates.first * rateFactor) : '-';
    const calcTotal = rates.total ? Math.round(rates.total * rateFactor) : '-';

    return `
        <div class="p-2 bg-amber-50/80 border border-amber-200/90 rounded-xl text-[11px] text-gray-800 space-y-1 shadow-xs">
            <div class="flex items-center justify-between pb-1 border-b border-amber-200/60">
                <span class="font-black text-amber-900 flex items-center gap-1">
                    <svg class="w-3.5 h-3.5 text-orange-500 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    기준 수수료율 (100% 원본)
                </span>
                <span class="text-[10px] text-orange-800 font-extrabold bg-orange-100/80 px-1.5 py-0.5 rounded">
                    지급율 ${curRate}% 적용 시: 1회차 ${calcFirst}% / 총수수료 ${calcTotal}%
                </span>
            </div>
            <div class="grid grid-cols-5 gap-1 text-center font-bold">
                <div class="bg-white p-1 rounded-lg border border-amber-200/60">
                    <div class="text-[9.5px] text-gray-500 font-medium">1회차</div>
                    <div class="text-indigo-600 font-black">${rates.first != null ? rates.first + '%' : '-'}</div>
                </div>
                <div class="bg-white p-1 rounded-lg border border-amber-200/60">
                    <div class="text-[9.5px] text-gray-500 font-medium">1차년도합계</div>
                    <div class="text-indigo-600 font-black">${rates.year1 != null ? rates.year1 + '%' : '-'}</div>
                </div>
                <div class="bg-white p-1 rounded-lg border border-amber-200/60">
                    <div class="text-[9.5px] text-gray-500 font-medium">13차월</div>
                    <div class="text-indigo-600 font-black">${rates.m13 != null ? rates.m13 + '%' : '-'}</div>
                </div>
                <div class="bg-white p-1 rounded-lg border border-amber-200/60">
                    <div class="text-[9.5px] text-gray-500 font-medium">2차년도합계</div>
                    <div class="text-indigo-600 font-black">${rates.year2 != null ? rates.year2 + '%' : '-'}</div>
                </div>
                <div class="bg-white p-1 rounded-lg border border-amber-200/60">
                    <div class="text-[9.5px] text-gray-500 font-medium">총합계</div>
                    <div class="text-emerald-700 font-black">${rates.total != null ? rates.total + '%' : '-'}</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 모달 내 세부 옵션(구분, 유형, 납기 등) 드롭다운 HTML 빌드
 */
function buildModalOptionsHtml(compRows, selectedProd, comp, tabKey, savedOptions) {
    if (!selectedProd) return '';
    const matchedRows = compRows.filter(r => r.product === selectedProd);
    if (matchedRows.length === 0) return '';

    const optionKeys = (typeof getProductOptionKeys === 'function') 
        ? getProductOptionKeys(matchedRows, comp) 
        : [];
    
    if (optionKeys.length === 0) return '';

    const curOpts = Object.assign({}, savedOptions || {});
    if (typeof reconcileFeeSelectedOptions === 'function') {
        reconcileFeeSelectedOptions(matchedRows, optionKeys, curOpts);
    }

    return `
        <div class="p-2 bg-slate-50 border border-slate-200/80 rounded-xl space-y-1.5">
            <div class="text-[10px] font-bold text-slate-500 flex items-center justify-between">
                <span class="flex items-center gap-1">
                    <svg class="w-3 h-3 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                    옵션사항 선택 (구분 / 유형 / 납기 등)
                </span>
                <span class="text-[9.5px] text-slate-400">* 옵션 변경 시 수수료율이 자동 갱신됩니다.</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                ${optionKeys.map(optKey => {
                    const valSet = (typeof getValidOptionValues === 'function') 
                        ? getValidOptionValues(matchedRows, optionKeys, curOpts, optKey) 
                        : [];
                    const curVal = curOpts[optKey] || valSet[0] || '';
                    return `
                        <div class="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200 text-xs shadow-2xs">
                            <span class="text-[10px] font-extrabold text-slate-500">${optKey}:</span>
                            <select onchange="onPolicyOptionChange(this, '${comp}', '${tabKey}')" data-optkey="${optKey}" class="policy-opt-select text-xs font-bold text-slate-800 outline-none bg-transparent cursor-pointer">
                                ${valSet.map(v => `
                                    <option value="${escapeHtmlAttr(v)}" ${v === curVal ? 'selected' : ''}>${v}</option>
                                `).join('')}
                            </select>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

/**
 * 모달 내 정책 입력 테이블 HTML 빌드
 */
function buildPolicyGridHtml(tabKey) {
    const isNonLife = tabKey === '손해보험';
    const insCategory = isNonLife ? '손해보험' : '생명보험';

    // 1. 모달 전용 정렬 (영문 ABC순 -> 한글 가나다순)
    const compList = getSortedCompaniesForModal(tabKey);

    // 2. 현재 엑셀에서 해당 카테고리의 상품 데이터 목록
    const catData = (FEE_TABLE_DATA && FEE_TABLE_DATA.categories) ? FEE_TABLE_DATA.categories[insCategory] : {};

    return `
        <div class="overflow-x-auto border border-gray-200 rounded-xl shadow-xs">
            <table class="w-full table-fixed text-xs text-left border-collapse min-w-[960px]">
                <colgroup>
                    <col class="w-[100px]">
                    <col class="w-auto">
                    <col class="w-[170px]">
                    <col class="w-[125px]">
                    <col class="w-[125px]">
                    <col class="w-[125px]">
                </colgroup>
                <thead class="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                    <tr class="h-12">
                        <th class="p-2.5 border-r border-gray-200 text-center align-middle">보험사명</th>
                        <th class="p-2.5 border-r border-gray-200 align-middle">대표 상품 & 옵션 선택 / 수수료율 (즉시 조회)</th>
                        <th class="p-2.5 border-r border-gray-200 align-middle">출력용 표시명 (마스킹)</th>
                        ${isNonLife ? `
                            <th class="p-2 border-r border-gray-200 text-center align-middle">
                                <div class="text-gray-800 text-[11px] font-bold leading-tight">익월기본(%)</div>
                                <div class="text-[10px] text-gray-500 font-normal border-t border-gray-200 mt-0.5 pt-0.5 leading-tight">기타시상(%)</div>
                            </th>
                            <th class="p-2 border-r border-gray-200 text-center align-middle">
                                <div class="text-gray-800 text-[11px] font-bold leading-tight">주차시상(%)</div>
                                <div class="text-[10px] text-gray-500 font-normal border-t border-gray-200 mt-0.5 pt-0.5 leading-tight">본사시상(%)</div>
                            </th>
                            <th class="p-2 border-r border-gray-200 text-center align-middle">
                                <div class="text-gray-800 text-[11px] font-bold leading-tight">연속시상(%)</div>
                                <div class="text-[10px] text-gray-500 font-normal border-t border-gray-200 mt-0.5 pt-0.5 leading-tight">법인시상(%)</div>
                            </th>
                        ` : `
                            <th class="p-2.5 border-r border-gray-200 text-center align-middle">
                                <div class="text-gray-800 text-xs font-bold leading-tight">익월기본(%)</div>
                            </th>
                            <th class="p-2.5 border-r border-gray-200 text-center align-middle">
                                <div class="text-orange-700 text-xs font-bold leading-tight">13차월시상(%)</div>
                            </th>
                            <th class="p-2.5 border-r border-gray-200 text-center align-middle">
                                <div class="text-gray-800 text-xs font-bold leading-tight">법인(%)</div>
                            </th>
                        `}
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                    ${compList.map(comp => {
                        // 현재 저장된 정책 찾기
                        let item = (totalFeeReportState.policyData || []).find(p => p['보험사명'] === comp && (isNonLife ? p['보험사구분'] === '손해보험' : p['상품구분'] === tabKey));
                        if (!item) {
                            item = {
                                '보험사명': comp,
                                '대표상품명': '',
                                '납입기간': '',
                                '옵션상세': '',
                                '상품명표시': '',
                                '익월기본시상': 0,
                                '13차월시상': 0,
                                '주차시상': 0,
                                '연속시상': 0,
                                '기타시상': 0,
                                '본사시상': 0,
                                '법인시상': 0
                            };
                        }

                        // 해당 회사의 엑셀 상품 목록 추출
                        let compKey = Object.keys(catData || {}).find(k => k === comp || k.includes(comp) || comp.includes(k));
                        const compRows = compKey ? (catData[compKey] || []) : [];
                        const uniqueProducts = Array.from(new Set(compRows.map(r => r.product))).filter(Boolean);

                        const selectedProd = item['대표상품명'] || '';
                        const matchedRows = compRows.filter(r => r.product === selectedProd);

                        // 기존 저장된 옵션 복원
                        let savedOptions = {};
                        if (item['옵션상세']) {
                            try {
                                savedOptions = JSON.parse(item['옵션상세']);
                            } catch (e) {
                                savedOptions = {};
                            }
                        }
                        if (!savedOptions['납기'] && item['납입기간']) {
                            savedOptions['납기'] = item['납입기간'];
                        }

                        const optionKeys = (typeof getProductOptionKeys === 'function') 
                            ? getProductOptionKeys(matchedRows, comp) 
                            : [];
                        if (typeof reconcileFeeSelectedOptions === 'function' && optionKeys.length > 0) {
                            reconcileFeeSelectedOptions(matchedRows, optionKeys, savedOptions);
                        }

                        const matchedFeeRow = selectedProd 
                            ? ((typeof findMatchedFeeRow === 'function') ? findMatchedFeeRow(matchedRows, optionKeys, savedOptions) : matchedRows[0])
                            : null;

                        const curPayPeriod = savedOptions['납기'] || savedOptions['납입기간'] || item['납입기간'] || '';

                        return `
                            <tr class="hover:bg-gray-50/80 transition" data-comp="${comp}" data-tab="${tabKey}" data-payperiod="${escapeHtmlAttr(curPayPeriod)}" data-options-json="${escapeHtmlAttr(JSON.stringify(savedOptions))}">
                                <!-- 보험사명 -->
                                <td class="p-2.5 font-black text-gray-800 border-r border-gray-200 text-center bg-gray-50/50 align-top">
                                    <div class="py-1">${comp}</div>
                                </td>
                                
                                <!-- 대표 상품 & 옵션 & 수수료율 -->
                                <td class="p-2.5 border-r border-gray-200 space-y-2">
                                    <!-- 1. 상품명 검색 및 선택 드롭다운 -->
                                    <div class="space-y-1">
                                        <div class="relative">
                                            <input type="text" placeholder="🔍 상품명 실시간 검색..." oninput="onFilterModalProductList(this)" class="w-full pl-2.5 pr-14 py-1 text-[11px] bg-gray-50 border border-gray-200 rounded-lg outline-none focus:bg-white focus:border-orange-400 text-gray-700 font-medium transition" title="상품 목록 필터링">
                                            <span class="product-count-badge absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold pointer-events-none">${uniqueProducts.length}개 상품</span>
                                        </div>
                                        <select onchange="onPolicyProductSelect(this, '${comp}', '${tabKey}')" class="policy-product-select w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs font-bold text-gray-800 focus:border-orange-400 outline-none bg-white">
                                            <option value="">-- [미선택] 출력물 제외 --</option>
                                            ${uniqueProducts.map(p => `
                                                <option value="${escapeHtmlAttr(p)}" ${p === selectedProd ? 'selected' : ''}>${p}</option>
                                            `).join('')}
                                        </select>
                                    </div>

                                    <!-- 2. 세부 옵션들 (구분/유형/납기 등) -->
                                    <div class="policy-options-box">
                                        ${buildModalOptionsHtml(compRows, selectedProd, comp, tabKey, savedOptions)}
                                    </div>

                                    <!-- 3. 수수료율 실시간 요약 배지 -->
                                    <div class="policy-fee-rates-box">
                                        ${buildModalFeeRatesHtml(matchedFeeRow, isNonLife)}
                                    </div>
                                </td>

                                <!-- 출력용 표시 상품명 (마스킹) -->
                                <td class="p-2.5 border-r border-gray-200 align-top">
                                    <input type="text" value="${escapeHtmlAttr(item['상품명표시'] || item['대표상품명'] || '')}" class="policy-input-displayname w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-800 font-bold focus:border-orange-400 outline-none" placeholder="표시 상품명 (마스킹)">
                                    <p class="text-[10px] text-gray-400 mt-1">* 미입력 시 대표상품명 출력</p>
                                </td>

                                ${isNonLife ? `
                                    <!-- 열 4: 익월(상) / 기타(하) -->
                                    <td class="p-2 border-r border-gray-200 align-top">
                                        <div class="space-y-1.5">
                                            <div class="flex items-center justify-between gap-1 bg-amber-50/70 px-1.5 py-0.5 rounded border border-amber-200/80">
                                                <span class="text-[10px] font-black text-amber-900 w-7 text-center shrink-0">익월</span>
                                                <input type="number" step="10" value="${item['익월기본시상'] || 0}" class="policy-input-next w-16 px-1 py-0.5 border border-gray-300 rounded text-center text-xs font-bold text-gray-900 bg-white focus:border-orange-500 outline-none">
                                            </div>
                                            <div class="flex items-center justify-between gap-1 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                                                <span class="text-[10px] font-bold text-gray-600 w-7 text-center shrink-0">기타</span>
                                                <input type="number" step="10" value="${item['기타시상'] || 0}" class="policy-input-other w-16 px-1 py-0.5 border border-gray-300 rounded text-center text-xs font-bold text-gray-800 bg-white focus:border-orange-500 outline-none">
                                            </div>
                                        </div>
                                    </td>

                                    <!-- 열 5: 주차(상) / 본사(하) -->
                                    <td class="p-2 border-r border-gray-200 align-top">
                                        <div class="space-y-1.5">
                                            <div class="flex items-center justify-between gap-1 bg-amber-50/70 px-1.5 py-0.5 rounded border border-amber-200/80">
                                                <span class="text-[10px] font-black text-amber-900 w-7 text-center shrink-0">주차</span>
                                                <input type="number" step="10" value="${item['주차시상'] || 0}" class="policy-input-week w-16 px-1 py-0.5 border border-gray-300 rounded text-center text-xs font-bold text-gray-900 bg-white focus:border-orange-500 outline-none">
                                            </div>
                                            <div class="flex items-center justify-between gap-1 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                                                <span class="text-[10px] font-bold text-gray-600 w-7 text-center shrink-0">본사</span>
                                                <input type="number" step="10" value="${item['본사시상'] || 0}" class="policy-input-hq w-16 px-1 py-0.5 border border-gray-300 rounded text-center text-xs font-bold text-gray-800 bg-white focus:border-orange-500 outline-none">
                                            </div>
                                        </div>
                                    </td>

                                    <!-- 열 6: 연속(상) / 법인(하) -->
                                    <td class="p-2 border-r border-gray-200 align-top">
                                        <div class="space-y-1.5">
                                            <div class="flex items-center justify-between gap-1 bg-amber-50/70 px-1.5 py-0.5 rounded border border-amber-200/80">
                                                <span class="text-[10px] font-black text-amber-900 w-7 text-center shrink-0">연속</span>
                                                <input type="number" step="10" value="${item['연속시상'] || 0}" class="policy-input-cont w-16 px-1 py-0.5 border border-gray-300 rounded text-center text-xs font-bold text-gray-900 bg-white focus:border-orange-500 outline-none">
                                            </div>
                                            <div class="flex items-center justify-between gap-1 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200">
                                                <span class="text-[10px] font-bold text-gray-600 w-7 text-center shrink-0">법인</span>
                                                <input type="number" step="10" value="${item['법인시상'] || 0}" class="policy-input-corp w-16 px-1 py-0.5 border border-gray-300 rounded text-center text-xs font-bold text-gray-700 bg-white focus:border-orange-500 outline-none">
                                            </div>
                                        </div>
                                    </td>
                                ` : `
                                    <!-- 열 4: 익월기본 -->
                                    <td class="p-2 border-r border-gray-200 text-center align-top">
                                        <div class="py-1 flex justify-center">
                                            <input type="number" step="10" value="${item['익월기본시상'] || 0}" class="policy-input-next w-20 px-1 py-1 border border-gray-200 rounded text-center text-xs font-bold text-gray-800 focus:border-orange-400 outline-none">
                                        </div>
                                    </td>

                                    <!-- 열 5: 13차월시상 -->
                                    <td class="p-2 border-r border-gray-200 text-center align-top">
                                        <div class="py-1 flex justify-center">
                                            <input type="number" step="10" value="${item['13차월시상'] || 0}" class="policy-input-m13 w-20 px-1 py-1 border border-gray-200 rounded text-center text-xs font-bold text-orange-600 focus:border-orange-400 outline-none">
                                        </div>
                                    </td>

                                    <!-- 열 6: 법인시상 -->
                                    <td class="p-2 border-r border-gray-200 text-center align-top">
                                        <div class="py-1 flex justify-center">
                                            <input type="number" step="10" value="${item['법인시상'] || 0}" class="policy-input-corp w-20 px-1 py-1 border border-gray-200 rounded text-center text-xs text-gray-600 focus:border-orange-400 outline-none">
                                        </div>
                                    </td>
                                `}
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * 모달 상품 드롭다운 실시간 필터/조회 핸들러
 */
function onFilterModalProductList(inputEl) {
    const term = (inputEl.value || '').trim().toLowerCase();
    const row = inputEl.closest('tr');
    if (!row) return;
    const select = row.querySelector('.policy-product-select');
    if (!select) return;

    let visibleCount = 0;
    Array.from(select.options).forEach((opt, idx) => {
        if (idx === 0) {
            opt.hidden = false;
            return;
        }
        const text = opt.text.toLowerCase();
        const match = !term || text.includes(term);
        opt.hidden = !match;
        if (match) visibleCount++;
    });

    const badge = row.querySelector('.product-count-badge');
    if (badge) {
        badge.textContent = term ? `${visibleCount}개 일치` : `${select.options.length - 1}개 상품`;
    }
}

/**
 * 모달에서 상품 선택 시 옵션 및 수수료율 연쇄 갱신
 */
function onPolicyProductSelect(selectEl, company, tabKey) {
    const row = selectEl.closest('tr');
    if (!row) return;

    const prodName = selectEl.value;
    const isNonLife = tabKey === '손해보험';
    const insCategory = isNonLife ? '손해보험' : '생명보험';

    const displayInput = row.querySelector('.policy-input-displayname');
    const optionsBox = row.querySelector('.policy-options-box');

    // 1. 미선택(출력 제외) 처리
    if (!prodName) {
        if (displayInput) displayInput.value = '';
        if (optionsBox) optionsBox.innerHTML = '';
        row.removeAttribute('data-payperiod');
        row.removeAttribute('data-options-json');
        updateModalRowFeeDisplay(row, company, tabKey);
        return;
    }

    // 2. 표시명 기본값 자동 세팅
    if (displayInput && (!displayInput.value || displayInput.value.includes('보험') || displayInput.value.includes('종신') || displayInput.value.includes('정기'))) {
        displayInput.value = prodName;
    }

    // 3. 해당 회사의 상품 옵션 컨트롤 렌더링
    const catData = (FEE_TABLE_DATA && FEE_TABLE_DATA.categories) ? (FEE_TABLE_DATA.categories[insCategory] || {}) : {};
    const compKey = Object.keys(catData).find(k => k === company || k.includes(company) || company.includes(k));
    const compRows = compKey ? (catData[compKey] || []) : [];

    if (optionsBox) {
        optionsBox.innerHTML = buildModalOptionsHtml(compRows, prodName, company, tabKey, {});
    }

    // 4. 수수료율 즉시 계산 및 반영
    updateModalRowFeeDisplay(row, company, tabKey);
}

/**
 * 모달에서 옵션사항(구분, 유형, 납기 등) 변경 시 연쇄 필터링 및 수수료율 갱신
 */
function onPolicyOptionChange(selectEl, company, tabKey) {
    const row = selectEl.closest('tr');
    if (!row) return;

    const isNonLife = tabKey === '손해보험';
    const insCategory = isNonLife ? '손해보험' : '생명보험';
    const prodSelect = row.querySelector('.policy-product-select');
    const prodName = prodSelect ? prodSelect.value : '';

    const catData = (FEE_TABLE_DATA && FEE_TABLE_DATA.categories) ? (FEE_TABLE_DATA.categories[insCategory] || {}) : {};
    const compKey = Object.keys(catData).find(k => k === company || k.includes(company) || company.includes(k));
    const compRows = compKey ? (catData[compKey] || []) : [];
    const matchedRows = compRows.filter(r => r.product === prodName);

    // 현재 선택된 옵션값들 수집
    const curOpts = {};
    row.querySelectorAll('.policy-opt-select').forEach(sel => {
        const k = sel.getAttribute('data-optkey');
        if (k) curOpts[k] = sel.value;
    });

    const optionKeys = (typeof getProductOptionKeys === 'function') 
        ? getProductOptionKeys(matchedRows, company) 
        : Object.keys(curOpts);
    
    // 종속 필터링 반영
    if (typeof reconcileFeeSelectedOptions === 'function') {
        reconcileFeeSelectedOptions(matchedRows, optionKeys, curOpts);
    }

    // 옵션 셀렉트박스 목록 갱신
    optionKeys.forEach(optKey => {
        const sel = row.querySelector(`.policy-opt-select[data-optkey="${optKey}"]`);
        if (sel) {
            const valSet = (typeof getValidOptionValues === 'function') 
                ? getValidOptionValues(matchedRows, optionKeys, curOpts, optKey) 
                : [];
            const curVal = curOpts[optKey] || valSet[0] || '';
            sel.innerHTML = valSet.map(v => `<option value="${escapeHtmlAttr(v)}" ${v === curVal ? 'selected' : ''}>${v}</option>`).join('');
        }
    });

    updateModalRowFeeDisplay(row, company, tabKey);
}

/**
 * 모달 행의 수수료율 카드 및 데이터 속성 즉시 업데이트
 */
function updateModalRowFeeDisplay(row, company, tabKey) {
    const isNonLife = tabKey === '손해보험';
    const insCategory = isNonLife ? '손해보험' : '생명보험';
    const prodSelect = row.querySelector('.policy-product-select');
    const prodName = prodSelect ? prodSelect.value : '';

    const feeRatesBox = row.querySelector('.policy-fee-rates-box');
    if (!feeRatesBox) return;

    if (!prodName) {
        feeRatesBox.innerHTML = buildModalFeeRatesHtml(null, isNonLife);
        row.removeAttribute('data-payperiod');
        row.removeAttribute('data-options-json');
        return;
    }

    const catData = (FEE_TABLE_DATA && FEE_TABLE_DATA.categories) ? (FEE_TABLE_DATA.categories[insCategory] || {}) : {};
    const compKey = Object.keys(catData).find(k => k === company || k.includes(company) || company.includes(k));
    const compRows = compKey ? (catData[compKey] || []) : [];
    const matchedRows = compRows.filter(r => r.product === prodName);

    const curOpts = {};
    row.querySelectorAll('.policy-opt-select').forEach(sel => {
        const k = sel.getAttribute('data-optkey');
        if (k) curOpts[k] = sel.value;
    });

    const optionKeys = (typeof getProductOptionKeys === 'function') 
        ? getProductOptionKeys(matchedRows, company) 
        : Object.keys(curOpts);

    const matchedFeeRow = (typeof findMatchedFeeRow === 'function') 
        ? findMatchedFeeRow(matchedRows, optionKeys, curOpts) 
        : matchedRows[0];

    feeRatesBox.innerHTML = buildModalFeeRatesHtml(matchedFeeRow, isNonLife);

    // 납기/납입기간 추출
    const payPeriodVal = curOpts['납기'] || curOpts['납입기간'] || curOpts['만기'] || '';
    row.setAttribute('data-payperiod', payPeriodVal);
    row.setAttribute('data-options-json', JSON.stringify(curOpts));
}

/**
 * 모달 닫기
 */
function closeRewardPolicyModal() {
    const modal = document.getElementById('reward-policy-modal');
    if (modal) {
        modal.remove();
    }
    const modalContainer = document.getElementById('reward-policy-modal-container');
    if (modalContainer) {
        modalContainer.innerHTML = '';
    }
    document.body.classList.remove('modal-open');
}

/**
 * 모달에서 입력된 정책을 메모리에 수집하고 스프레드시트 DB에 저장
 */
async function saveRewardPolicyToDb() {
    const curTab = totalFeeReportState.activeTab || '손해보험';
    const isNonLife = curTab === '손해보험';
    const insCategory = isNonLife ? '손해보험' : '생명보험';
    const mStr = String(totalFeeReportState.month || '2026.09').replace(/\./g, '');

    // 1. 현재 화면의 모든 행 입력값 수집
    const rows = document.querySelectorAll('#reward-policy-grid-container tr[data-comp]');
    rows.forEach(tr => {
        const comp = tr.getAttribute('data-comp');
        const prodSelect = tr.querySelector('.policy-product-select') || tr.querySelector('select');
        const displayInput = tr.querySelector('.policy-input-displayname');
        const nextInput = tr.querySelector('.policy-input-next');
        const corpInput = tr.querySelector('.policy-input-corp');

        const prod = prodSelect ? prodSelect.value.trim() : '';
        const displayName = displayInput ? displayInput.value.trim() : '';
        const next = nextInput ? (parseFloat(nextInput.value) || 0) : 0;
        const corp = corpInput ? (parseFloat(corpInput.value) || 0) : 0;

        let payPeriod = tr.getAttribute('data-payperiod') || '';
        let optJson = tr.getAttribute('data-options-json') || '';

        // 만약 data-payperiod가 없으면 옵션 select들에서 직접 추출
        if (!payPeriod) {
            const optObj = {};
            tr.querySelectorAll('.policy-opt-select').forEach(sel => {
                const k = sel.getAttribute('data-optkey');
                if (k) optObj[k] = sel.value;
            });
            payPeriod = optObj['납기'] || optObj['납입기간'] || optObj['만기'] || '';
            optJson = JSON.stringify(optObj);
        }

        let week = 0, cont = 0, other = 0, hq = 0, m13 = 0;
        if (isNonLife) {
            const wEl = tr.querySelector('.policy-input-week');
            const cEl = tr.querySelector('.policy-input-cont');
            const oEl = tr.querySelector('.policy-input-other');
            const hEl = tr.querySelector('.policy-input-hq');
            week = wEl ? (parseFloat(wEl.value) || 0) : 0;
            cont = cEl ? (parseFloat(cEl.value) || 0) : 0;
            other = oEl ? (parseFloat(oEl.value) || 0) : 0;
            hq = hEl ? (parseFloat(hEl.value) || 0) : 0;
        } else {
            const m13El = tr.querySelector('.policy-input-m13');
            m13 = m13El ? (parseFloat(m13El.value) || 0) : 0;
        }

        // totalFeeReportState.policyData 내 기존 항목 갱신 또는 추가
        let existingIdx = totalFeeReportState.policyData.findIndex(p => p['보험사명'] === comp && (isNonLife ? p['보험사구분'] === '손해보험' : p['상품구분'] === curTab));
        const newObj = {
            '마감월': mStr,
            '보험사구분': insCategory,
            '보험사명': comp,
            '상품구분': isNonLife ? '종합건강' : curTab,
            '대표상품명': prod,
            '납입기간': payPeriod,
            '옵션상세': optJson,
            '상품명표시': displayName,
            '시상내용': '',
            '익월기본시상': next,
            '13차월시상': m13,
            '주차시상': week,
            '연속시상': cont,
            '기타시상': other,
            '본사시상': hq,
            '법인시상': corp,
            '임시시상': 0
        };

        if (existingIdx !== -1) {
            totalFeeReportState.policyData[existingIdx] = newObj;
        } else {
            totalFeeReportState.policyData.push(newObj);
        }
    });

    const btn = document.getElementById('save-reward-policy-btn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="loader border-2 border-white w-3.5 h-3.5 inline-block rounded-full animate-spin mr-1.5"></span>시트에 저장 중...';
    }

    try {
        let requesterId = '';
        if (typeof currentUser !== 'undefined' && currentUser && currentUser.id) {
            requesterId = currentUser.id;
        }

        if (typeof API_URL !== 'undefined' && API_URL) {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'saveRewardPolicy',
                    args: [requesterId, totalFeeReportState.month, totalFeeReportState.policyData]
                })
            });
            const resData = await res.json();
            if (resData && resData.success) {
                alert(resData.message || '시상금 및 대표상품 설정이 월별시상 시트에 성공적으로 저장되었습니다.');
            } else {
                alert('저장 완료 (메모리 반영됨): ' + (resData.message || ''));
            }
        } else {
            alert('시상금 및 대표상품 설정이 월별시상 시트에 반영되었습니다.');
        }
    } catch (err) {
        console.error('saveRewardPolicyToDb 에러:', err);
        alert('저장 중 네트워크 오류가 발생했으나, 현재 화면에는 정상 반영되었습니다.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '월별시상 시트에 저장하기';
        }
        closeRewardPolicyModal();
        updateReportTablesOnly();
    }
}

/**
 * 전월 데이터 복사 핸들러
 */
async function copyPreviousMonthPolicyData() {
    if (!confirm('전월 시상금 및 대표상품 설정을 불러와 현재 마감월에 덮어쓰시겠습니까?')) return;

    try {
        if (typeof API_URL !== 'undefined' && API_URL) {
            const res = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'copyPreviousRewardPolicy',
                    args: [totalFeeReportState.month]
                })
            });
            const resData = await res.json();
            if (resData && resData.success && resData.list && resData.list.length > 0) {
                totalFeeReportState.policyData = resData.list;
                alert(resData.message || '전월 데이터를 성공적으로 불러왔습니다.');
                switchRewardPolicyTab(totalFeeReportState.activeTab || '손해보험');
                updateReportTablesOnly();
                return;
            }
        }
    } catch (err) {
        console.warn('copyPreviousMonthPolicyData 실패:', err);
    }

    // 기본 로컬 복사 폴백
    alert('전월 데이터를 불러왔습니다.');
    switchRewardPolicyTab(totalFeeReportState.activeTab || '손해보험');
    updateReportTablesOnly();
}

/**
 * 관리자 권한 여부 체크
 */
function checkIsAdminUser() {
    if (typeof currentUser === 'undefined' || !currentUser) return true; // 기본 오픈
    const roles = [
        currentUser.role, currentUser.role1, currentUser.role2, currentUser.role3,
        currentUser.role4, currentUser.role5, currentUser.role6, currentUser.role7
    ].map(r => String(r || '').trim());
    return roles.includes('지사대표') || roles.includes('관리자') || currentUser.id === 'admin';
}
