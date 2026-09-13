/**
 * ==============================================================================
 * 파트너스 보드 - 수수료 예시표 조회 시스템 (script_fee_table.js)
 * - 손해보험(12개사) / 생명보험(17개사) 통합 지원
 * - 13차월 포함 반응형 요약 카드 및 월 보험료 원화 환산 시뮬레이터
 * - 관리자/지사대표 전용 지급율 조정 컨트롤 (일반 사용자에게는 지급율 UI 완전 숨김)
 * ==============================================================================
 */

var FEE_TABLE_DATA = null;
var feeTableAvailableMonths = [];
var feeTableLoading = false;

var feeTableState = {
    month: '', // 현재 선택된 기준월 (예: '2026.09')
    category: '손해보험', // '손해보험' | '생명보험'
    company: '한화손보',
    searchKeyword: '',
    selectedProduct: '',
    selectedOptions: {},
    premium: 150000, // 기본 월납 보험료 150,000원
    overrideRate: null // 관리자/지사대표가 조정한 지급율 (null이면 자동 계산, 최초 디폴트값: 내지급율)
};

/**
 * 보험사 목록 정렬 및 필터링
 * - 손해보험: 한화손보, 흥국화재, KB손보, DB손보, 삼성화재, 하나손보, 현대해상, 롯데손보, 메리츠, 농협손보, AIG손보 (MG손보 제외)
 * - 생명보험: 1번 한화생명, 2번 KB라이프, 이후 한글 가나다순 / 영문 ABC순
 */
function sortInsuranceCompanies(list, category) {
    if (category === '손해보험') {
        const order = [
            '한화손보', '흥국화재', 'KB손보', 'DB손보', '삼성화재', 
            '하나손보', '현대해상', '롯데손보', '메리츠', '농협손보', 'AIG손보'
        ];
        // MG손보 제외
        const filtered = list.filter(c => !c.includes('MG'));
        filtered.sort((a, b) => {
            const idxA = order.indexOf(a);
            const idxB = order.indexOf(b);
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.localeCompare(b, 'ko', { sensitivity: 'base' });
        });
        return filtered;
    } else if (category === '생명보험') {
        const top1 = '한화생명';
        const top2 = 'KB라이프';
        const sorted = [...list];
        sorted.sort((a, b) => {
            if (a === top1) return -1;
            if (b === top1) return 1;
            if (a === top2) return -1;
            if (b === top2) return 1;
            return a.localeCompare(b, 'ko', { sensitivity: 'base' });
        });
        return sorted;
    } else {
        const sorted = [...list];
        sorted.sort((a, b) => a.localeCompare(b, 'ko', { sensitivity: 'base' }));
        return sorted;
    }
}

/**
 * 보험사별 13차월(2차년도 분할) 합산 표기 보정
 * - 13~14차월(2개월분) 합산 표시 회사: 1/2로 계산 (DB손보, KB손보)
 * - 13~15차월(3개월분) 합산 표시 회사: 1/3로 계산 (농협손보, 삼성화재, 현대해상, 흥국화재)
 */
function getAdjustedBaseRates(rates, companyName) {
    if (!rates) return { first: 0, year1: 0, m13: 0, year2: 0, year3: 0, total: 0 };
    // 파싱 및 빌드 시점에 모든 손보/생보사의 고유 정책(선지급, 분급, 분할 합산 등)이
    // 이미 정확한 13차월 수치(rates.m13)로 계산되어 있으므로 추가 분할 없이 그대로 사용합니다.
    return { ...rates };
}

/**
 * 옵션 계층 우선순위 (상위 -> 하위 계층 구조)
 * 상위 옵션 선택에 따라 하위 옵션 목록이 동적으로 연쇄 필터링됩니다.
 */
const FEE_OPTION_PRIORITY = [
    '특약유형', '보종구분', '보종', '형 구분', '구분', 
    '종형', '종 구분', '종별', '담보별', '담보구분', '담보', 
    '유형', '만기구분', '만기', '납입주기', '납기', '납입기간', 
    '보험료', '월납보험료', '최초보험료', '가입금액'
];

/**
 * 상품 데이터 행들로부터 정렬된 유효 옵션 키 목록 추출
 * (미래에셋 '장기유지' 등 불필요 키 자동 제외)
 */
function getProductOptionKeys(rows) {
    if (!rows || rows.length === 0) return [];
    
    // 1. 모든 고유 옵션 키 수집
    const rawKeys = [];
    rows.forEach(row => {
        if (row.options) {
            Object.keys(row.options).forEach(k => {
                if (k.includes('장기유지')) return; // 장기유지 옵션 숨김
                if (k === '상품 구분' || k === '상품구분') return; // 교보 등 상품구분 제외
                if (!rawKeys.includes(k)) rawKeys.push(k);
            });
        }
    });

    // 2. 수수료에 실질적 영향을 미치는지 판별하는 필터링
    // (a) 고유 옵션값 개수가 1개뿐인 키는 선택 의미가 없으므로 제외
    // (b) 고유 옵션값 개수가 2개 이상이더라도, 그 옵션을 변경했을 때 수수료율이 달라지는 경우가 없다면 제외
    const rateSig = (r) => {
        const rates = r.rates || {};
        return `${rates.first || 0}|${rates.year1 || 0}|${rates.m13 || 0}|${rates.year2 || 0}|${rates.year3 || 0}|${rates.total || 0}`;
    };

    // 전체 행의 수수료율이 100% 동일한지 확인
    const firstSig = rateSig(rows[0]);
    const allSameRate = rows.every(r => rateSig(r) === firstSig);

    const meaningfulKeys = rawKeys.filter(k => {
        const uniqueVals = new Set();
        rows.forEach(r => {
            if (r.options && r.options[k] && r.options[k] !== '-') {
                uniqueVals.add(r.options[k]);
            }
        });
        // 옵션 값이 1개 이하이면 선택할 필요 없으므로 제외
        if (uniqueVals.size <= 1) return false;

        // 전체 행의 수수료가 완전히 동일한 경우 옵션 칩 불필요
        if (allSameRate) return false;

        // k를 제외한 나머지 옵션 키들
        const otherKeys = rawKeys.filter(ok => ok !== k);
        if (otherKeys.length === 0) return true;

        // 다른 옵션 조건이 같을 때 k값에 따라 수수료율에 차이가 발생하는지 확인
        const groups = {};
        rows.forEach(r => {
            if (!r.options || !r.options[k]) return;
            const gKey = otherKeys.map(ok => r.options[ok] || '').join('||');
            if (!groups[gKey]) groups[gKey] = [];
            groups[gKey].push(r);
        });

        let hasVariation = false;
        let comparableCount = 0;
        for (const gKey in groups) {
            const grp = groups[gKey];
            if (grp.length > 1) {
                comparableCount++;
                const baseS = rateSig(grp[0]);
                for (let i = 1; i < grp.length; i++) {
                    if (rateSig(grp[i]) !== baseS) {
                        hasVariation = true;
                        break;
                    }
                }
            }
            if (hasVariation) break;
        }

        // 비교 가능한 그룹이 있었던 경우: 수수료율 차이가 있으면 유지, 없으면(수수료에 영향 없음) 제거
        if (comparableCount > 0) {
            return hasVariation;
        }

        // 비교 가능한 동일 조건 행이 없는 경우(단순 분기)는 보존
        return true;
    });

    // 3. 계층 우선순위 정렬
    meaningfulKeys.sort((a, b) => {
        const idxA = FEE_OPTION_PRIORITY.findIndex(p => a.includes(p) || p.includes(a));
        const idxB = FEE_OPTION_PRIORITY.findIndex(p => b.includes(p) || p.includes(b));
        const orderA = idxA === -1 ? 999 : idxA;
        const orderB = idxB === -1 ? 999 : idxB;
        return orderA - orderB;
    });

    return meaningfulKeys;
}

/**
 * 상위 옵션 선택 조건에 따라 실제로 유효한 하위 옵션 값 목록 추출 (연쇄적 종속 필터링)
 */
function getValidOptionValues(rows, optionKeys, selectedOptions, targetKey) {
    const targetIdx = optionKeys.indexOf(targetKey);
    // targetKey 이전(상위)의 모든 선택 조건을 만족하는 데이터 행만 필터링
    const filteredRows = rows.filter(r => {
        if (!r.options) return true;
        for (let j = 0; j < targetIdx; j++) {
            const prevKey = optionKeys[j];
            const selVal = selectedOptions[prevKey];
            if (selVal && r.options[prevKey] && r.options[prevKey] !== selVal) {
                return false;
            }
        }
        return true;
    });

    const valSet = [];
    filteredRows.forEach(r => {
        if (r.options && r.options[targetKey]) {
            const val = r.options[targetKey];
            if (!valSet.includes(val)) valSet.push(val);
        }
    });
    return valSet;
}

/**
 * 선택된 옵션값들이 현재 상위 옵션 상태에서 유효한지 검사하고 자동 보정
 */
function reconcileFeeSelectedOptions(rows, optionKeys, selectedOptions) {
    if (!rows || rows.length === 0) return;
    optionKeys.forEach(k => {
        const valSet = getValidOptionValues(rows, optionKeys, selectedOptions, k);
        if (valSet.length > 0) {
            if (!selectedOptions[k] || !valSet.includes(selectedOptions[k])) {
                selectedOptions[k] = valSet[0];
            }
        } else {
            delete selectedOptions[k];
        }
    });
}

/**
 * 조건에 가장 잘 일치하는 단일 데이터 행 찾기 (완벽 일치 -> 최다 일치 fallback)
 */
function findMatchedFeeRow(rows, optionKeys, selectedOptions) {
    if (!rows || rows.length === 0) return null;

    // 1. 완벽 일치 행 탐색
    let match = rows.find(r => {
        if (!r.options) return true;
        for (let k of optionKeys) {
            if (selectedOptions[k] && r.options[k] && r.options[k] !== selectedOptions[k]) {
                return false;
            }
        }
        return true;
    });
    if (match) return match;

    // 2. 부분 일치 점수 기반 탐색
    let bestScore = -1;
    let bestRow = rows[0];
    rows.forEach(r => {
        let score = 0;
        if (r.options) {
            for (let k of optionKeys) {
                if (selectedOptions[k] && r.options[k] === selectedOptions[k]) {
                    score++;
                }
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestRow = r;
        }
    });
    return bestRow;
}

/**
 * 옵션 선택 칩 HTML 생성 (연쇄 필터링 반영)
 */
function renderOptionChipsHtml(selectedProdRows, optionKeys, selectedOptions) {
    if (!selectedProdRows || selectedProdRows.length === 0 || optionKeys.length === 0) return '';
    reconcileFeeSelectedOptions(selectedProdRows, optionKeys, selectedOptions);

    return `
        <div class="pt-2.5 border-t border-slate-100 space-y-2">
            ${optionKeys.map(optKey => {
                const valSet = getValidOptionValues(selectedProdRows, optionKeys, selectedOptions, optKey);
                if (valSet.length === 0) return '';
                const curVal = selectedOptions[optKey] || valSet[0];

                return `
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="text-[11px] font-bold text-slate-400 w-16 flex-shrink-0">${optKey}:</span>
                        <div class="flex flex-wrap gap-1">
                            ${valSet.map(v => {
                                const selected = (v === curVal);
                                return `
                                    <button onclick="setFeeOption('${optKey}', '${v}')" class="px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${selected ? 'bg-slate-900 text-white shadow-xs scale-105' : 'bg-slate-100/80 text-slate-600 hover:bg-slate-200/80'}">
                                        ${v}
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * 현재 적용되는 지급율 계산
 * - 관리자/지사대표가 임의 조정한 경우 overrideRate 반환
 * - 일반 사용자는 본인의 사용자정보 시트 상 지급율 (손보/생보) 자동 적용
 */
function getEffectiveFeeRate() {
    if (feeTableState.overrideRate !== null && !isNaN(feeTableState.overrideRate)) {
        return parseFloat(feeTableState.overrideRate);
    }
    if (!state.user) return 84.0;
    
    if (feeTableState.category === '생명보험') {
        const r = parseFloat(state.user.lifeRate);
        return (!isNaN(r) && r > 0) ? r : 82.0;
    } else {
        const r = parseFloat(state.user.nonLifeRate);
        return (!isNaN(r) && r > 0) ? r : 84.0;
    }
}

/**
 * 구글 드라이브로부터 수수료 예시표 데이터 비동기 로드
 */
async function loadFeeTableData(targetMonth = null, forceReload = false) {
    const monthParam = targetMonth || feeTableState.month || '';

    // 이미 데이터가 있고 강제 새로고침이 아니며, 대상 월이 동일하거나 미지정인 경우 캐시 유지
    if (!forceReload && FEE_TABLE_DATA && FEE_TABLE_DATA.categories && (!targetMonth || targetMonth === feeTableState.month)) {
        renderFeeTableView();
        return;
    }

    if (feeTableLoading) return;
    feeTableLoading = true;
    renderFeeTableView(); // 로딩 스피너 표시

    try {
        const staffId = (state.user && state.user.staffId) ? state.user.staffId : (state.user ? state.user.id : '');

        const [monthsRes, dataRes] = await Promise.all([
            (feeTableAvailableMonths.length === 0 || forceReload) ? callApi('getAvailableFeeMonths') : Promise.resolve({ success: true, months: feeTableAvailableMonths }),
            callApi('getFeeTableData', staffId, monthParam)
        ]);

        if (monthsRes && monthsRes.success && Array.isArray(monthsRes.months)) {
            feeTableAvailableMonths = monthsRes.months;
        }

        if (dataRes && dataRes.success && dataRes.data) {
            FEE_TABLE_DATA = dataRes.data;
            feeTableState.month = dataRes.month || monthParam;
            if (dataRes.rates && state.user) {
                if (dataRes.rates.nonLifeRate) state.user.nonLifeRate = dataRes.rates.nonLifeRate;
                if (dataRes.rates.lifeRate) state.user.lifeRate = dataRes.rates.lifeRate;
            }
        } else {
            FEE_TABLE_DATA = null;
            console.warn('Fee table data not found for month:', monthParam, dataRes);
        }
    } catch (err) {
        console.error('loadFeeTableData error:', err);
        FEE_TABLE_DATA = null;
    } finally {
        feeTableLoading = false;
        renderFeeTableView();
    }
}

/**
 * 수수료 예시표 메인 뷰 렌더링
 */
function renderFeeTableView() {
    const container = document.getElementById('main-view');
    if (!container) return;

    // 1. 로딩 중 상태
    if (feeTableLoading) {
        container.innerHTML = `
            <div class="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-100 max-w-md mx-auto mt-16 animate-fadeIn">
                <div class="w-12 h-12 rounded-2xl bg-orange-50 text-primary flex items-center justify-center mx-auto mb-4 animate-bounce">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                </div>
                <h3 class="font-extrabold text-slate-900 text-lg whitespace-nowrap">최신 수수료 데이터를 불러오는 중입니다.</h3>
            </div>
        `;
        return;
    }

    // 2. 데이터가 아직 로드되지 않은 초기 상태
    if (!FEE_TABLE_DATA || !FEE_TABLE_DATA.categories) {
        const isManager = isBranchRepAny() || isAdminAny() || isOpsAny();
        container.innerHTML = `
            <div class="bg-white rounded-3xl p-8 text-center shadow-sm border border-slate-100 max-w-lg mx-auto mt-12 animate-fadeIn">
                <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <h3 class="font-bold text-slate-800 text-lg mb-2">등록된 수수료 예시표가 없습니다</h3>
                <p class="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
                    구글 드라이브에 등록된 수수료 데이터가 없습니다.<br>
                    ${isManager ? '손보/생보 엑셀 파일을 업로드하여 데이터를 등록해 주세요.' : '관리자에게 수수료 데이터 업로드를 요청해 주세요.'}
                </p>
                <div class="flex items-center justify-center gap-3">
                    <button onclick="loadFeeTableData(null, true)" class="px-5 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs sm:text-sm hover:bg-slate-200 transition">다시 시도</button>
                    ${isManager ? `
                        <button onclick="openFeeExcelUploadModal()" class="px-5 py-2.5 bg-primary text-white font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-orange-500/20 hover:bg-primaryHover transition flex items-center gap-1.5">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                            수수료 엑셀 업로드
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        return;
    }

    const categories = FEE_TABLE_DATA.categories;
    const catCompanies = categories[feeTableState.category] || {};
    const rawCompanyList = Object.keys(catCompanies);
    const companyList = sortInsuranceCompanies(rawCompanyList, feeTableState.category);

    // 유효한 보험사 선택 보장
    if (!catCompanies[feeTableState.company] && companyList.length > 0) {
        feeTableState.company = companyList[0];
        feeTableState.selectedProduct = '';
        feeTableState.selectedOptions = {};
    }

    const currentRows = catCompanies[feeTableState.company] || [];

    // 유효한 상품 목록 추출 (안내 메시지 행 자동 제외)
    const productMap = {};
    currentRows.forEach(row => {
        if (row.product) {
            const p = row.product.trim();
            if (/수수료\s*타입|수수료타입/.test(p)) return;
            if (!productMap[p]) productMap[p] = [];
            productMap[p].push(row);
        }
    });
    const productList = Object.keys(productMap);

    // 검색 필터 적용
    const kw = feeTableState.searchKeyword.trim().toLowerCase();
    const filteredProducts = kw 
        ? productList.filter(p => p.toLowerCase().includes(kw))
        : productList;

    // 현재 선택된 상품 보장
    if (!productMap[feeTableState.selectedProduct] || (kw && !filteredProducts.includes(feeTableState.selectedProduct))) {
        feeTableState.selectedProduct = filteredProducts.length > 0 ? filteredProducts[0] : '';
        feeTableState.selectedOptions = {};
    }

    const selectedProdRows = feeTableState.selectedProduct ? productMap[feeTableState.selectedProduct] : [];

    // 옵션 키 목록 및 연쇄 필터링 보정
    const optionKeys = getProductOptionKeys(selectedProdRows);
    reconcileFeeSelectedOptions(selectedProdRows, optionKeys, feeTableState.selectedOptions);

    // 조건에 가장 잘 일치하는 단일 데이터 행 찾기
    const matchedRow = findMatchedFeeRow(selectedProdRows, optionKeys, feeTableState.selectedOptions);

    // 수수료율 및 원화 금액 계산
    const currentRate = getEffectiveFeeRate();
    const multiplier = currentRate / 100.0;
    const premium = (feeTableState.premium !== undefined && feeTableState.premium !== null) ? feeTableState.premium : 150000;

    const rawBaseRates = matchedRow ? matchedRow.rates : { first: 0, year1: 0, m13: 0, year2: 0, year3: 0, total: 0 };
    const baseRates = getAdjustedBaseRates(rawBaseRates, feeTableState.company);
    
    // 계산된 수수료율 (지급율 반영)
    const calcRates = {
        first: Math.round(baseRates.first * multiplier * 10) / 10,
        year1: Math.round(baseRates.year1 * multiplier * 10) / 10,
        m13:   Math.round(baseRates.m13 * multiplier * 10) / 10,
        year2: Math.round(baseRates.year2 * multiplier * 10) / 10,
        year3: Math.round((baseRates.year3 || 0) * multiplier * 10) / 10,
        total: Math.round(baseRates.total * multiplier * 10) / 10
    };

    // 실수령 원화 환산
    const calcAmounts = {
        first: Math.round(premium * (calcRates.first / 100.0)),
        year1: Math.round(premium * (calcRates.year1 / 100.0)),
        m13:   Math.round(premium * (calcRates.m13 / 100.0)),
        year2: Math.round(premium * (calcRates.year2 / 100.0)),
        year3: Math.round(premium * (calcRates.year3 / 100.0)),
        total: Math.round(premium * (calcRates.total / 100.0))
    };

    const isLife = (feeTableState.category === '생명보험');
    const role1 = (state.user && state.user.role) ? String(state.user.role).trim() : '';
    const isSimAllowed = ['지사대표', '운영진', '관리자'].includes(role1);
    const isManager = isBranchRepAny() || isAdminAny() || isOpsAny();

    container.innerHTML = `
        <div class="space-y-4 pb-16 max-w-7xl mx-auto animate-fadeIn">
            
            <!-- 1. Header & Quick Controls (컴팩트 높이) -->
            <div class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-sm">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                        </div>
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <h2 class="text-xl font-black tracking-tight text-slate-900">수수료 예시표</h2>
                                <!-- 기준월 선택 셀렉트박스 -->
                                <div class="relative inline-flex items-center">
                                    <select id="ft-month-select" onchange="loadFeeTableData(this.value, true)" class="appearance-none bg-orange-50 hover:bg-orange-100/80 border border-orange-200 text-orange-800 text-[11px] font-bold py-0.5 pl-2.5 pr-6 rounded-full cursor-pointer focus:outline-none transition">
                                        ${(feeTableAvailableMonths.length > 0 ? feeTableAvailableMonths : [FEE_TABLE_DATA.month || '2026.09']).map(m => `
                                            <option value="${m}" ${m === feeTableState.month ? 'selected' : ''}>${m} 기준</option>
                                        `).join('')}
                                    </select>
                                    <div class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-orange-600">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>
                                ${isManager ? `
                                    <button onclick="openFeeExcelUploadModal()" class="px-2 py-0.5 bg-slate-800 hover:bg-slate-900 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-xs transition">
                                        <svg class="w-3 h-3 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                        엑셀 업로드
                                    </button>
                                    <button onclick="navigate('totalFeeReport')" class="px-2.5 py-0.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-[11px] font-bold flex items-center gap-1 shadow-xs transition">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                        총수당 예시표 PDF
                                    </button>
                                ` : ''}
                            </div>
                            <p class="text-[11px] text-slate-400">보험사 및 상품별 실수령 수수료율과 예상 수령액을 실시간으로 확인하세요.</p>
                        </div>
                    </div>
                </div>

                <!-- 지급율 시뮬레이션 카드 (권한1: 지사대표, 운영진, 관리자 전용) -->
                ${isSimAllowed ? `
                <div class="bg-slate-50 border border-slate-200/80 rounded-xl p-3 w-full lg:w-auto min-w-[300px] shadow-2xs">
                    <div class="flex justify-between items-center mb-1.5">
                        <span class="text-[11px] font-extrabold text-slate-700 flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                            지급율 시뮬레이션
                        </span>
                        <span class="text-xs font-black text-primary" id="ft-payout-display">${currentRate.toFixed(1)}%</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <input type="range" min="50" max="100" step="0.5" value="${currentRate}" id="ft-payout-slider" class="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary">
                        <input type="number" min="50" max="100" step="0.5" value="${currentRate}" id="ft-payout-input" class="w-14 px-1.5 py-0.5 bg-white border border-slate-200 rounded-md text-xs font-bold text-center text-slate-800 focus:outline-none focus:border-primary">
                    </div>
                    <div class="flex items-center justify-between gap-1 mt-1.5">
                        <button onclick="setFeePayoutRate(75)" class="flex-1 py-0.5 text-[10px] font-bold rounded ${feeTableState.overrideRate === 75 ? 'bg-orange-500 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}">75%</button>
                        <button onclick="setFeePayoutRate(80)" class="flex-1 py-0.5 text-[10px] font-bold rounded ${feeTableState.overrideRate === 80 ? 'bg-orange-500 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}">80%</button>
                        <button onclick="setFeePayoutRate(85)" class="flex-1 py-0.5 text-[10px] font-bold rounded ${feeTableState.overrideRate === 85 ? 'bg-orange-500 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}">85%</button>
                        <button onclick="setFeePayoutRate(90)" class="flex-1 py-0.5 text-[10px] font-bold rounded ${feeTableState.overrideRate === 90 ? 'bg-orange-500 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}">90%</button>
                        <button onclick="resetFeePayoutRate()" class="flex-1 py-0.5 text-[10px] font-bold rounded ${feeTableState.overrideRate === null ? 'bg-primary text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'}">내지급율</button>
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- 2. Category Tab & Company Chips (컴팩트 가로 배치) -->
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <!-- 손보 vs 생보 -->
                <div class="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl flex-shrink-0">
                    <button onclick="switchFeeCategory('손해보험')" class="px-4 py-1.5 rounded-lg font-extrabold text-xs transition-all ${feeTableState.category === '손해보험' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}">
                        손해보험 <span class="text-[10px] font-normal opacity-70">(${sortInsuranceCompanies(Object.keys(categories['손해보험'] || {}), '손해보험').length})</span>
                    </button>
                    <button onclick="switchFeeCategory('생명보험')" class="px-4 py-1.5 rounded-lg font-extrabold text-xs transition-all ${feeTableState.category === '생명보험' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}">
                        생명보험 <span class="text-[10px] font-normal opacity-70">(${sortInsuranceCompanies(Object.keys(categories['생명보험'] || {}), '생명보험').length})</span>
                    </button>
                </div>

                <!-- Company Chips (가나다/ABC 순, 예외 우선순위 반영) -->
                <div id="ft-company-chips-container" class="relative flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none flex-grow">
                    ${companyList.map(comp => {
                        const active = (feeTableState.company === comp);
                        return `
                            <button onclick="switchFeeCompany('${comp}')" class="px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all ${active ? 'ft-active-company-btn bg-primary text-white shadow-sm scale-[1.02]' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200/80'}">
                                ${comp}
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- 3. PC 2열 반응형 그리드: [좌측: 상품/옵션 선택] + [우측: 월 보험료 시뮬레이터] -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
                <!-- 좌측 (7열): 상품 검색 및 옵션 칩 -->
                <div class="lg:col-span-7 bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-100 flex flex-col justify-between space-y-3">
                    <!-- Search Input & Product Selector (좌우 2칸) -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 mb-1">상품 검색</label>
                            <div class="relative">
                                <input type="text" id="ft-product-search" value="${feeTableState.searchKeyword}" placeholder="상품명 키워드 검색" class="w-full pl-8 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary focus:bg-white transition" oninput="handleFeeProductSearch(this.value)">
                                <div class="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                                </div>
                                <button id="ft-search-clear-btn" onclick="clearFeeProductSearch()" class="absolute right-2 top-2 text-slate-400 hover:text-slate-600 ${feeTableState.searchKeyword ? '' : 'hidden'}">
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label id="ft-product-count-label" class="block text-[11px] font-bold text-slate-500 mb-1">상품 선택 (상품 수 : ${filteredProducts.length}개)</label>
                            <select id="ft-product-select" class="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-primary focus:bg-white transition" onchange="selectFeeProduct(this.value)">
                                ${filteredProducts.map(p => `
                                    <option value="${p}" ${p === feeTableState.selectedProduct ? 'selected' : ''}>${p}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Dynamic Option Selector Chips (만기, 납기, 구분 등 연쇄 필터링) -->
                    <div id="ft-options-container">
                        ${renderOptionChipsHtml(selectedProdRows, optionKeys, feeTableState.selectedOptions)}
                    </div>
                </div>

                <!-- 우측 (5열): Monthly Premium Simulator (컴팩트 카드 형태) -->
                <div class="lg:col-span-5 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-2xl p-4 sm:p-5 text-white shadow-sm flex flex-col justify-between space-y-3">
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-[10px] font-extrabold uppercase tracking-widest text-orange-400">Premium Simulator</span>
                            <span class="text-[10px] text-slate-400">실시간 원화 환산</span>
                        </div>
                        <h3 class="text-base sm:text-lg font-black text-white">월 예상 보험료 입력</h3>
                    </div>

                    <div class="space-y-2.5">
                        <div class="relative">
                            <input type="text" id="ft-premium-input" value="${premium.toLocaleString('ko-KR')}" class="w-full px-3.5 py-2.5 bg-white/10 border border-white/20 rounded-xl text-base font-black text-white text-right focus:outline-none focus:border-orange-400 focus:bg-white/20 transition pr-8" oninput="handleFeePremiumInput(this.value)">
                            <span class="absolute right-3 top-2.5 text-xs font-bold text-slate-300">원</span>
                        </div>
                        <div class="grid grid-cols-4 gap-1.5">
                            <button onclick="setFeePremium(100000)" class="py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition">10만</button>
                            <button onclick="setFeePremium(300000)" class="py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition">30만</button>
                            <button onclick="setFeePremium(500000)" class="py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition">50만</button>
                            <button onclick="addFeePremium(50000)" class="py-1.5 bg-orange-500/30 hover:bg-orange-500/40 text-orange-300 border border-orange-400/30 rounded-lg text-xs font-bold transition">+5만</button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 6. Reactive Fee Summary KPI Cards (13차월 2차년도 앞 필수 포함!) -->
            <div>
                <div class="flex justify-between items-center mb-4 px-1">
                    <h4 class="font-extrabold text-base text-slate-800 flex items-center gap-2">
                        <span class="w-2 h-4 bg-primary rounded-full inline-block"></span>
                        예상 수수료율 및 실수령 금액 요약
                    </h4>
                    <span class="text-xs text-slate-400 font-medium">단위: % / 원</span>
                </div>

                <div class="grid grid-cols-2 sm:grid-cols-3 ${isLife ? 'lg:grid-cols-6' : 'lg:grid-cols-5'} gap-3 sm:gap-4">
                    
                    <!-- Card 1: 1회차 (익월) - 월차 수수료 (블루 계열) -->
                    <div class="bg-gradient-to-br from-blue-50/60 to-indigo-50/30 rounded-3xl p-5 border border-blue-100 shadow-sm flex flex-col justify-between hover:border-blue-200 transition">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-extrabold text-blue-900">1회차 (익월)</span>
                            <span class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">1</span>
                        </div>
                        <div>
                            <p class="text-xl sm:text-2xl font-black text-blue-950 tracking-tight"><span id="ft-rate-first">${calcRates.first.toFixed(1)}</span><span class="text-sm font-bold text-blue-400 ml-0.5">%</span></p>
                            <p class="text-xs sm:text-sm font-bold text-blue-600 mt-1"><span id="ft-amt-first">${calcAmounts.first.toLocaleString('ko-KR')}</span> <span class="text-[10px] text-slate-400">원</span></p>
                        </div>
                    </div>

                    <!-- Card 2: 1차년도 합계 - 연도 합계 (오렌지 계열 연하게) -->
                    <div class="bg-gradient-to-br from-orange-50/70 to-amber-50/40 rounded-3xl p-5 border border-orange-200/80 shadow-sm flex flex-col justify-between hover:border-orange-300 transition">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-extrabold text-orange-900">1차년도 합계</span>
                            <span class="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] font-bold">Y1</span>
                        </div>
                        <div>
                            <p class="text-xl sm:text-2xl font-black text-orange-950 tracking-tight"><span id="ft-rate-year1">${calcRates.year1.toFixed(1)}</span><span class="text-sm font-bold text-orange-400 ml-0.5">%</span></p>
                            <p class="text-xs sm:text-sm font-bold text-orange-700 mt-1"><span id="ft-amt-year1">${calcAmounts.year1.toLocaleString('ko-KR')}</span> <span class="text-[10px] text-slate-400">원</span></p>
                        </div>
                    </div>

                    <!-- Card 3: 13차월 - 월차 수수료 (1회차와 동일한 블루 계열) -->
                    <div class="bg-gradient-to-br from-blue-50/60 to-indigo-50/30 rounded-3xl p-5 border border-blue-100 shadow-sm flex flex-col justify-between hover:border-blue-200 transition">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-extrabold text-blue-900">13차월</span>
                            <span class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">13M</span>
                        </div>
                        <div>
                            <p class="text-xl sm:text-2xl font-black text-blue-950 tracking-tight"><span id="ft-rate-m13">${calcRates.m13.toFixed(1)}</span><span class="text-sm font-bold text-blue-400 ml-0.5">%</span></p>
                            <p class="text-xs sm:text-sm font-bold text-blue-600 mt-1"><span id="ft-amt-m13">${calcAmounts.m13.toLocaleString('ko-KR')}</span> <span class="text-[10px] text-slate-400">원</span></p>
                        </div>
                    </div>

                    <!-- Card 4: 2차년도 합계 - 연도 합계 (오렌지 계열 연하게) -->
                    <div class="bg-gradient-to-br from-orange-50/70 to-amber-50/40 rounded-3xl p-5 border border-orange-200/80 shadow-sm flex flex-col justify-between hover:border-orange-300 transition">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-extrabold text-orange-900">2차년도 합계</span>
                            <span class="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] font-bold">Y2</span>
                        </div>
                        <div>
                            <p class="text-xl sm:text-2xl font-black text-orange-950 tracking-tight"><span id="ft-rate-year2">${calcRates.year2.toFixed(1)}</span><span class="text-sm font-bold text-orange-400 ml-0.5">%</span></p>
                            <p class="text-xs sm:text-sm font-bold text-orange-700 mt-1"><span id="ft-amt-year2">${calcAmounts.year2.toLocaleString('ko-KR')}</span> <span class="text-[10px] text-slate-400">원</span></p>
                        </div>
                    </div>

                    <!-- Card 5: 3차년도 합계 (생보사 전용) - 연도 합계 (오렌지 계열 연하게) -->
                    ${isLife ? `
                    <div class="bg-gradient-to-br from-orange-50/70 to-amber-50/40 rounded-3xl p-5 border border-orange-200/80 shadow-sm flex flex-col justify-between hover:border-orange-300 transition">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-extrabold text-orange-900">3차년도 합계</span>
                            <span class="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] font-bold">Y3</span>
                        </div>
                        <div>
                            <p class="text-xl sm:text-2xl font-black text-orange-950 tracking-tight"><span id="ft-rate-year3">${calcRates.year3.toFixed(1)}</span><span class="text-sm font-bold text-orange-400 ml-0.5">%</span></p>
                            <p class="text-xs sm:text-sm font-bold text-orange-700 mt-1"><span id="ft-amt-year3">${calcAmounts.year3.toLocaleString('ko-KR')}</span> <span class="text-[10px] text-slate-400">원</span></p>
                        </div>
                    </div>
                    ` : ''}

                    <!-- Card 6: 총 수령액 합계 (강조 카드 - 선명한 오렌지 그라데이션 메인) -->
                    <div class="bg-gradient-to-tr from-primary to-orange-400 rounded-3xl p-5 text-white shadow-lg shadow-orange-500/25 flex flex-col justify-between ${!isLife ? 'col-span-2 sm:col-span-1' : ''}">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-black uppercase tracking-wider text-orange-100">총 수령액 합계</span>
                            <span class="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">TOTAL</span>
                        </div>
                        <div>
                            <p class="text-2xl sm:text-3xl font-black tracking-tight"><span id="ft-rate-total">${calcRates.total.toFixed(1)}</span><span class="text-base font-bold text-orange-100 ml-0.5">%</span></p>
                            <p class="text-sm sm:text-base font-black text-white mt-1 drop-shadow-xs"><span id="ft-amt-total">${calcAmounts.total.toLocaleString('ko-KR')}</span> <span class="text-xs font-medium text-orange-100">원</span></p>
                        </div>
                    </div>

                </div>
            </div>

            <!-- 7. Information Notice -->
            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200/60 text-xs text-slate-500 flex items-start gap-2.5">
                <span class="text-orange-500 font-bold mt-0.5">※</span>
                <p class="leading-relaxed">
                    본 수수료 예시표는 제휴 보험사별 대표 상품의 참고용 지급률 데이터입니다. 실제 입금되는 수수료는 계약 유지 여부, 실효/연체, 시책 및 개인 업적 달성 구간에 따라 차이가 발생할 수 있습니다.
                </p>
            </div>

        </div>
    `;

    // 이벤트 리스너 바인딩 (시뮬레이션 슬라이더)
    if (isSimAllowed) {
        const slider = document.getElementById('ft-payout-slider');
        const input = document.getElementById('ft-payout-input');
        if (slider) {
            slider.oninput = (e) => {
                const val = parseFloat(e.target.value);
                setFeePayoutRate(val, false);
            };
        }
        if (input) {
            input.onchange = (e) => {
                let val = parseFloat(e.target.value);
                if (isNaN(val)) val = 84;
                if (val < 50) val = 50;
                if (val > 100) val = 100;
                setFeePayoutRate(val, true);
            };
        }
    }

    // 선택된 보험사 버튼이 스크롤 영역 내에 항상 유지/노출되도록 위치 자동 조정
    const scrollToActiveCompany = () => {
        const chipsContainer = document.getElementById('ft-company-chips-container');
        const activeBtn = chipsContainer ? chipsContainer.querySelector('.ft-active-company-btn') : null;
        if (chipsContainer && activeBtn) {
            const targetLeft = activeBtn.offsetLeft - (chipsContainer.clientWidth / 2) + (activeBtn.offsetWidth / 2);
            chipsContainer.scrollLeft = Math.max(0, targetLeft);
        }
    };
    scrollToActiveCompany();
    requestAnimationFrame(scrollToActiveCompany);
    setTimeout(scrollToActiveCompany, 50);
}

/**
 * 대분류 탭 전환 (손보 <-> 생보)
 */
function switchFeeCategory(cat) {
    if (feeTableState.category === cat) return;
    feeTableState.category = cat;
    feeTableState.company = '';
    feeTableState.searchKeyword = '';
    feeTableState.selectedProduct = '';
    feeTableState.selectedOptions = {};
    renderFeeTableView();
}

/**
 * 보험사 변경
 */
function switchFeeCompany(comp) {
    if (feeTableState.company === comp) return;
    feeTableState.company = comp;
    feeTableState.searchKeyword = '';
    feeTableState.selectedProduct = '';
    feeTableState.selectedOptions = {};
    renderFeeTableView();
}

function updateFeeCalculations() {
    if (!FEE_TABLE_DATA) return;
    const catCompanies = FEE_TABLE_DATA.categories[feeTableState.category] || {};
    const currentRows = catCompanies[feeTableState.company] || [];

    const productMap = {};
    currentRows.forEach(row => {
        if (row.product) {
            const p = row.product.trim();
            if (/수수료\s*타입|수수료타입/.test(p)) return;
            if (!productMap[p]) productMap[p] = [];
            productMap[p].push(row);
        }
    });

    const selectedProdRows = feeTableState.selectedProduct ? (productMap[feeTableState.selectedProduct] || []) : [];
    const optionKeys = getProductOptionKeys(selectedProdRows);
    reconcileFeeSelectedOptions(selectedProdRows, optionKeys, feeTableState.selectedOptions);

    const matchedRow = findMatchedFeeRow(selectedProdRows, optionKeys, feeTableState.selectedOptions);

    const currentRate = getEffectiveFeeRate();
    const multiplier = currentRate / 100.0;
    const premium = (feeTableState.premium !== undefined && feeTableState.premium !== null) ? feeTableState.premium : 150000;
    const rawBaseRates = matchedRow ? matchedRow.rates : { first: 0, year1: 0, m13: 0, year2: 0, year3: 0, total: 0 };
    const baseRates = getAdjustedBaseRates(rawBaseRates, feeTableState.company);

    const calcRates = {
        first: Math.round(baseRates.first * multiplier * 10) / 10,
        year1: Math.round(baseRates.year1 * multiplier * 10) / 10,
        m13:   Math.round(baseRates.m13 * multiplier * 10) / 10,
        year2: Math.round(baseRates.year2 * multiplier * 10) / 10,
        year3: Math.round((baseRates.year3 || 0) * multiplier * 10) / 10,
        total: Math.round(baseRates.total * multiplier * 10) / 10
    };

    const calcAmounts = {
        first: Math.round(premium * (calcRates.first / 100.0)),
        year1: Math.round(premium * (calcRates.year1 / 100.0)),
        m13:   Math.round(premium * (calcRates.m13 / 100.0)),
        year2: Math.round(premium * (calcRates.year2 / 100.0)),
        year3: Math.round(premium * (calcRates.year3 / 100.0)),
        total: Math.round(premium * (calcRates.total / 100.0))
    };

    const rateFirst = document.getElementById('ft-rate-first');
    const amtFirst = document.getElementById('ft-amt-first');
    if (rateFirst) rateFirst.innerText = calcRates.first.toFixed(1);
    if (amtFirst) amtFirst.innerText = calcAmounts.first.toLocaleString('ko-KR');

    const rateY1 = document.getElementById('ft-rate-year1');
    const amtY1 = document.getElementById('ft-amt-year1');
    if (rateY1) rateY1.innerText = calcRates.year1.toFixed(1);
    if (amtY1) amtY1.innerText = calcAmounts.year1.toLocaleString('ko-KR');

    const rateM13 = document.getElementById('ft-rate-m13');
    const amtM13 = document.getElementById('ft-amt-m13');
    if (rateM13) rateM13.innerText = calcRates.m13.toFixed(1);
    if (amtM13) amtM13.innerText = calcAmounts.m13.toLocaleString('ko-KR');

    const rateY2 = document.getElementById('ft-rate-year2');
    const amtY2 = document.getElementById('ft-amt-year2');
    if (rateY2) rateY2.innerText = calcRates.year2.toFixed(1);
    if (amtY2) amtY2.innerText = calcAmounts.year2.toLocaleString('ko-KR');

    const rateY3 = document.getElementById('ft-rate-year3');
    const amtY3 = document.getElementById('ft-amt-year3');
    if (rateY3) rateY3.innerText = calcRates.year3.toFixed(1);
    if (amtY3) amtY3.innerText = calcAmounts.year3.toLocaleString('ko-KR');

    const rateTotal = document.getElementById('ft-rate-total');
    const amtTotal = document.getElementById('ft-amt-total');
    if (rateTotal) rateTotal.innerText = calcRates.total.toFixed(1);
    if (amtTotal) amtTotal.innerText = calcAmounts.total.toLocaleString('ko-KR');
}

/**
 * 옵션 선택 칩 부분 렌더링 (연쇄 필터링 반영)
 */
function updateFeeOptionsUI() {
    const container = document.getElementById('ft-options-container');
    if (!container || !FEE_TABLE_DATA) return;

    const catCompanies = FEE_TABLE_DATA.categories[feeTableState.category] || {};
    const currentRows = catCompanies[feeTableState.company] || [];
    const productMap = {};
    currentRows.forEach(row => {
        if (row.product) {
            const p = row.product.trim();
            if (/수수료\s*타입|수수료타입/.test(p)) return;
            if (!productMap[p]) productMap[p] = [];
            productMap[p].push(row);
        }
    });

    const selectedProdRows = feeTableState.selectedProduct ? (productMap[feeTableState.selectedProduct] || []) : [];
    const optionKeys = getProductOptionKeys(selectedProdRows);
    container.innerHTML = renderOptionChipsHtml(selectedProdRows, optionKeys, feeTableState.selectedOptions);
}

/**
 * 상품 검색 인풋 (한글 조합/자모 분리 방지를 위해 인풋 리렌더링 없이 셀렉트박스/옵션/수치만 부분 갱신)
 */
function handleFeeProductSearch(val) {
    feeTableState.searchKeyword = val;

    const clearBtn = document.getElementById('ft-search-clear-btn');
    if (clearBtn) {
        if (val) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
    }

    if (!FEE_TABLE_DATA) return;
    const catCompanies = FEE_TABLE_DATA.categories[feeTableState.category] || {};
    const currentRows = catCompanies[feeTableState.company] || [];

    const productMap = {};
    currentRows.forEach(row => {
        if (row.product) {
            const p = row.product.trim();
            if (/수수료\s*타입|수수료타입/.test(p)) return;
            if (!productMap[p]) productMap[p] = [];
            productMap[p].push(row);
        }
    });
    const productList = Object.keys(productMap);

    const kw = val.trim().toLowerCase();
    const filteredProducts = kw 
        ? productList.filter(p => p.toLowerCase().includes(kw))
        : productList;

    if (!productMap[feeTableState.selectedProduct] || (kw && !filteredProducts.includes(feeTableState.selectedProduct))) {
        feeTableState.selectedProduct = filteredProducts.length > 0 ? filteredProducts[0] : '';
        feeTableState.selectedOptions = {};
    }

    const countLabel = document.getElementById('ft-product-count-label');
    if (countLabel) countLabel.innerText = `상품 선택 (상품 수 : ${filteredProducts.length}개)`;

    const select = document.getElementById('ft-product-select');
    if (select) {
        select.innerHTML = filteredProducts.map(p => `
            <option value="${p}" ${p === feeTableState.selectedProduct ? 'selected' : ''}>${p}</option>
        `).join('');
    }

    updateFeeOptionsUI();
    updateFeeCalculations();
}

/**
 * 검색어 클리어
 */
function clearFeeProductSearch() {
    feeTableState.searchKeyword = '';
    const input = document.getElementById('ft-product-search');
    if (input) input.value = '';
    handleFeeProductSearch('');
}

/**
 * 상품 선택
 */
function selectFeeProduct(prod) {
    feeTableState.selectedProduct = prod;
    feeTableState.selectedOptions = {};
    updateFeeOptionsUI();
    updateFeeCalculations();
}

/**
 * 동적 옵션 설정 (만기, 납기 등)
 */
function setFeeOption(key, val) {
    feeTableState.selectedOptions[key] = val;
    updateFeeOptionsUI();
    updateFeeCalculations();
}

/**
 * 월 보험료 입력 (한글/숫자 타이핑 시 전체 뷰 재렌더링 방지하여 포커스 및 입력 끊김 방지)
 */
function handleFeePremiumInput(val) {
    const raw = String(val).replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10);
    feeTableState.premium = isNaN(num) ? 0 : num;

    const input = document.getElementById('ft-premium-input');
    if (input) {
        const formatted = (feeTableState.premium || 0).toLocaleString('ko-KR');
        if (input.value !== formatted && raw !== '') {
            const pos = input.selectionEnd;
            input.value = formatted;
        }
    }
    updateFeeCalculations();
}

/**
 * 월 보험료 프리셋
 */
function setFeePremium(amt) {
    feeTableState.premium = amt;
    const input = document.getElementById('ft-premium-input');
    if (input) input.value = amt.toLocaleString('ko-KR');
    updateFeeCalculations();
}

/**
 * 월 보험료 추가
 */
function addFeePremium(delta) {
    feeTableState.premium = (feeTableState.premium || 0) + delta;
    const input = document.getElementById('ft-premium-input');
    if (input) input.value = feeTableState.premium.toLocaleString('ko-KR');
    updateFeeCalculations();
}

/**
 * 관리자 전용 지급율 변경
 */
function setFeePayoutRate(rate, fullRender = true) {
    feeTableState.overrideRate = rate;
    if (fullRender) {
        renderFeeTableView();
    } else {
        const display = document.getElementById('ft-payout-display');
        const input = document.getElementById('ft-payout-input');
        if (display) display.innerText = rate.toFixed(1) + '%';
        if (input) input.value = rate;
        renderFeeTableView();
    }
}

/**
 * 관리자 지급율 리셋 (내 지급율로 복원)
 */
function resetFeePayoutRate() {
    feeTableState.overrideRate = null;
    renderFeeTableView();
}

/**
 * ==============================================================================
 * 관리자 전용: 수수료 예시표 엑셀 업로드 및 브라우저 파서 (SheetJS)
 * ==============================================================================
 */

/**
 * 엑셀 업로드 모달 열기
 */
function openFeeExcelUploadModal() {
    const modalId = 'fee-excel-upload-modal';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = "fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn";
        document.body.appendChild(modal);
    }

    const defaultMonth = feeTableState.month || (state.currentMonth ? state.currentMonth : '2026.09');

    modal.innerHTML = `
        <div class="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col animate-scaleUp">
            <!-- Modal Header -->
            <div class="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-orange-100 text-primary flex items-center justify-center">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    </div>
                    <div>
                        <h3 class="font-extrabold text-slate-900 text-lg">수수료 예시표 엑셀 업로드</h3>
                        <p class="text-xs text-slate-400">손보 / 생보 엑셀 파일을 브라우저에서 파싱하여 드라이브에 저장합니다.</p>
                    </div>
                </div>
                <button onclick="closeFeeExcelUploadModal()" class="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <!-- Modal Body -->
            <div class="p-6 space-y-5">
                <!-- 1. Month Input -->
                <div>
                    <label class="block text-xs font-bold text-slate-600 mb-1.5">적용 기준월 (YYYY.MM)</label>
                    <input type="text" id="ft-upload-month" value="${defaultMonth}" placeholder="예: 2026.09" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-primary focus:bg-white transition">
                    <p class="text-[11px] text-slate-400 mt-1">※ 동일 기준월 데이터가 이미 존재하는 경우 최신 데이터로 덮어씌워집니다.</p>
                </div>

                <!-- 2. Non-Life Excel File -->
                <div class="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                            손해보험 엑셀 파일 (.xlsx)
                        </span>
                        <span class="text-[11px] font-medium text-slate-400">12개 손보사 시트</span>
                    </div>
                    <input type="file" id="ft-file-nonlife" accept=".xlsx,.xls" class="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer">
                </div>

                <!-- 3. Life Excel File -->
                <div class="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                            생명보험 엑셀 파일 (.xlsx)
                        </span>
                        <span class="text-[11px] font-medium text-slate-400">17개 생보사 시트</span>
                    </div>
                    <input type="file" id="ft-file-life" accept=".xlsx,.xls" class="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer">
                </div>

                <!-- Progress & Status -->
                <div id="ft-upload-status" class="hidden text-xs font-bold text-center py-2 px-3 rounded-xl"></div>
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                <button onclick="closeFeeExcelUploadModal()" class="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition">취소</button>
                <button id="ft-upload-submit-btn" onclick="executeFeeExcelUpload()" class="px-6 py-2.5 bg-primary text-white text-xs font-extrabold rounded-xl shadow-md shadow-orange-500/20 hover:bg-primaryHover transition flex items-center gap-1.5">
                    <span>변환 및 드라이브 저장</span>
                </button>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

/**
 * 엑셀 업로드 모달 닫기
 */
function closeFeeExcelUploadModal() {
    const modal = document.getElementById('fee-excel-upload-modal');
    if (modal) modal.classList.add('hidden');
}

/**
 * 브라우저에서 SheetJS로 단일 엑셀 워크북 파싱
 */
function parseFeeWorkbook(workbook, category) {
    const companyData = {};
    const sheetNames = workbook.SheetNames || [];

    sheetNames.forEach(sName => {
        if (sName.includes('변경')) return; // 변경내역 시트 제외
        if (sName.includes('MG')) return; // MG손보 신규계약 중단으로 파싱 및 업로드 제외
        const ws = workbook.Sheets[sName];
        if (!ws || !ws['!ref']) return;

        // 1. Row 1의 기준 지급율 탐색
        let baseRate = 1.0;
        for (let c = 0; c < 20; c++) {
            const cLetter = String.fromCharCode(65 + c);
            const cell = ws[`${cLetter}1`];
            if (cell && typeof cell.v === 'number') {
                const num = cell.v;
                if (num > 0.3 && num <= 1.0) {
                    baseRate = num;
                    break;
                }
            }
        }

        // 2. 셀 맵 구성
        const cellMap = {};
        for (let cellKey in ws) {
            if (cellKey[0] === '!') continue;
            const val = ws[cellKey].v;
            if (val !== undefined && val !== null) {
                cellMap[cellKey] = String(val).replace(/[\r\n]+/g, ' ').trim();
            }
        }

        // 3. 헤더 행 찾기 (10행 ~ 14행)
        let headerRow = 10;
        for (let h = 10; h <= 14; h++) {
            let rowText = '';
            for (let ci = 0; ci < 26; ci++) {
                const cl = String.fromCharCode(65 + ci);
                if (cellMap[`${cl}${h}`]) rowText += ' ' + cellMap[`${cl}${h}`];
            }
            if (/상품명|상품 명|보험종목|보종|구분/.test(rowText)) {
                headerRow = h;
                break;
            }
        }

        // 4. 열 매핑 (headerRow-1 ~ headerRow+2 다중 행 결합)
        const colHeaders = {};
        const maxCol = 35; // A to AI
        for (let ci = 1; ci <= maxCol; ci++) {
            const colLetter = ci <= 26 ? String.fromCharCode(64 + ci) : 'A' + String.fromCharCode(64 + ci - 26);
            let combHeader = '';
            for (let hr = headerRow - 1; hr <= headerRow + 2; hr++) {
                const cellVal = cellMap[`${colLetter}${hr}`] || '';
                if (cellVal && !/^[■※]|수수료타입|\(참고\)/.test(cellVal)) {
                    combHeader += ' ' + cellVal;
                }
            }
            combHeader = combHeader.trim();
            if (combHeader) colHeaders[colLetter] = combHeader;
        }

        let prodCol = 'A';
        const rateColMap = { first: null, year1: null, m13: null, year2: null, year3: null, total: null };

        for (let col in colHeaders) {
            const hText = colHeaders[col];
            if (/상품명|상품 명/.test(hText) && prodCol === 'A') {
                prodCol = col;
            }
            if (/총계|총수수료|총 수수료|합계계/.test(hText)) rateColMap.total = col;
            if (/1차년도 합계|1차년도합계|1차년계|1차년計|1차년 計/.test(hText)) rateColMap.year1 = col;
            if (/2차년도 합계|2차년도합계|2차년계|2차년計|2차년 計/.test(hText)) rateColMap.year2 = col;
            if (/3차년도 합계|3차년도합계|3차년계|3차년計|3차년 計/.test(hText)) rateColMap.year3 = col;
            if (/1회차|익월計|익월계|1회 지급\(1회차\)|성과수수료 \(1회차\)|장기성과수수료 \(1회차\)|신계약기본수수료 \(1회차\)|장기선급성과|GA성과수수료 \(1회차\)|모집수수료 \(1회차\)|신계약성과수수료 1회|모집수수료1/.test(hText)) {
                if (!rateColMap.first) rateColMap.first = col;
            }
            if (/13차월|13회차|13~14회차|13~15회차|13~24회차|13-24회차|13회 計|13회계|13회|13~18회/.test(hText)) {
                if (!rateColMap.m13) rateColMap.m13 = col;
            }
        }

        if (cellMap[`B${headerRow + 2}`] && !cellMap[`A${headerRow + 2}`]) {
            prodCol = 'B';
        }
        if (sName === '하나생명') {
            prodCol = 'A';
        }

        const rateCols = Object.values(rateColMap).filter(Boolean);
        let optCols = [];

        for (let col in colHeaders) {
            const hText = colHeaders[col];
            const isOpt = /납기|납입기간|납입주기|만기|종형|담보|가입금액|구좌|보종|특약유형|구분|종별|보험료|월납|보험종목|상품유형|주피연령|유형/.test(hText) &&
                          !/장기유지|계약유지|유지수수료|환산|성과|수수료|비고|수정율|수정률|월납대비|기준|[X×%]|지급|산출|초회보험료의/.test(hText) &&
                          !rateCols.includes(col) && col !== prodCol;
            if (isOpt) {
                let t = hText.split(' ')[0];
                if (/종형/.test(hText)) t = '종형';
                else if (/담보별/.test(hText)) t = '담보별';
                else if (/담보구분|담보/.test(hText)) t = '담보';
                else if (/가입금액/.test(hText)) t = '가입금액';
                else if (/최초보험료/.test(hText)) t = '최초보험료';
                else if (/월납보험료/.test(hText)) t = '월납보험료';
                else if (/보험료/.test(hText)) t = '보험료';
                else if (/납입기간|납기/.test(hText)) t = '납기';
                else if (/만기구분/.test(hText)) t = '만기구분';
                else if (/만기/.test(hText)) t = '만기';
                else if (/납입주기/.test(hText)) t = '납입주기';
                else if (/형 구분/.test(hText)) t = '형 구분';
                else if (/종 구분/.test(hText)) t = '종 구분';
                else if (/보종구분/.test(hText)) t = '보종구분';
                else if (/특약유형/.test(hText)) t = '특약유형';
                else if (/보험종목/.test(hText)) t = '보험종목';
                else if (/상품유형/.test(hText)) t = '상품유형';
                else if (/주피연령/.test(hText)) t = '주피연령';
                else if (/유형/.test(hText)) t = '유형';
                else if (/구분/.test(hText)) t = '구분';
                optCols.push({ col: col, title: t });
            }
        }

        // 회사별 optCols 미세 조정
        if (category === '생명보험') {
            if (sName === '교보생명') {
                optCols = optCols.filter(oc => oc.col !== 'A' && oc.title !== '상품 구분' && oc.title !== '상품구분');
            } else if (sName === '동양생명') {
                if (colHeaders['C'] && !optCols.some(oc => oc.col === 'C')) {
                    optCols.push({ col: 'C', title: '유형' });
                }
                if (colHeaders['H'] && !optCols.some(oc => oc.col === 'H')) {
                    optCols.push({ col: 'H', title: '주피연령' });
                }
            } else if (sName === '흥국생명') {
                if (colHeaders['B'] && !optCols.some(oc => oc.col === 'B')) {
                    optCols.push({ col: 'B', title: '보험종목' });
                }
            } else if (sName === '하나생명') {
                optCols = [
                    { col: 'B', title: '상품유형' },
                    { col: 'C', title: '납기' }
                ];
            }
        }

        // 동적 컬럼 탐색 (삼성생명, 농협생명, DB생명 등)
        const samsungBonusCols = [];
        const samsungMgmtCols = [];
        let nhPerfCol = null;
        let nhMgmtCol = null;
        let dbBonusCol = null;
        let dbMgmtCol = null;

        if (sName === '삼성생명') {
            let y2Start = false;
            Object.keys(colHeaders).sort().forEach(col => {
                const hText = colHeaders[col];
                if (/2차년도/.test(hText)) y2Start = true;
                if (/2차년도 합계|2차년도합계|2차년계|2차년計|2차년 計/.test(hText)) y2Start = false;
                if (/고능률보너스/.test(hText)) samsungBonusCols.push(col);
                if (y2Start && !/고능률보너스/.test(hText) && /계약관리|일반보장성|경영인정기|정기\/단체|연금\/저축|건강상해/.test(hText)) {
                    samsungMgmtCols.push(col);
                }
            });
        } else if (sName === '농협생명') {
            let y2Start = false;
            Object.keys(colHeaders).sort().forEach(col => {
                const hText = colHeaders[col];
                if (/2차년도/.test(hText)) y2Start = true;
                if (/2차년도 합계|2차년도합계|2차년계|2차년計|2차년 計/.test(hText)) y2Start = false;
                if (y2Start) {
                    if (/성과수수료/.test(hText)) nhPerfCol = col;
                    if (/계약관리수수료|계약관리/.test(hText)) nhMgmtCol = col;
                }
            });
        } else if (sName === 'DB생명') {
            let y2Start = false;
            Object.keys(colHeaders).sort().forEach(col => {
                const hText = colHeaders[col];
                if (/2차년도/.test(hText)) y2Start = true;
                if (/2차년도 합계|2차년도합계|2차년계|2차년計|2차년 計/.test(hText)) y2Start = false;
                if (y2Start) {
                    if (/성과보너스/.test(hText)) dbBonusCol = col;
                    if (/신계약관리수수료|계약관리/.test(hText)) dbMgmtCol = col;
                }
            });
        }

        // 5. 데이터 행 파싱
        let maxRow = 0;
        for (let k in cellMap) {
            const m = k.match(/^[A-Z]+(\d+)$/);
            if (m) {
                const rn = parseInt(m[1], 10);
                if (rn > maxRow) maxRow = rn;
            }
        }

        const dataRows = [];
        let lastProduct = '';
        const lastOpts = {};

        function getNormRate(colLetter, r) {
            if (!colLetter) return 0.0;
            const raw = cellMap[`${colLetter}${r}`];
            if (!raw) return 0.0;
            const num = parseFloat(String(raw).replace(/[^0-9.-]/g, ''));
            if (isNaN(num)) return 0.0;
            let v = num;
            if (baseRate > 0 && baseRate !== 1.0) {
                v = v / baseRate;
            }
            if (v > 0 && v < 30.0) {
                v = v * 100.0;
            }
            return Math.round(v * 100) / 100;
        }

        for (let r = headerRow + 1; r <= maxRow; r++) {
            const pVal = cellMap[`${prodCol}${r}`] || '';
            // 수수료 타입 변경 안내문 또는 합계/비고 행 제외
            if (/수수료\s*타입|수수료타입|합계|비고|※|업적|기준/.test(pVal)) continue;

            // 상품 변경 시 lastOpts 완전 초기화 (한화생명 등 빈 셀 상속 버그 차단)
            if (pVal && pVal !== lastProduct) {
                lastProduct = pVal;
                for (let k in lastOpts) delete lastOpts[k];
            }
            if (!lastProduct) continue;

            const totVal = rateColMap.total ? cellMap[`${rateColMap.total}${r}`] : null;
            const y1Val = rateColMap.year1 ? cellMap[`${rateColMap.year1}${r}`] : null;
            const hasRate = (totVal && !isNaN(parseFloat(totVal))) || (y1Val && !isNaN(parseFloat(y1Val)));
            if (!hasRate) continue;

            const rowOpts = {};
            optCols.forEach(oc => {
                const val = cellMap[`${oc.col}${r}`];
                if (val) lastOpts[oc.col] = val;
                const curOpt = lastOpts[oc.col] || '-';
                if (curOpt && curOpt !== '-') {
                    const title = oc.title || '조건';
                    rowOpts[title] = curOpt;
                }
            });

            let rFirst = getNormRate(rateColMap.first, r);
            let rY1 = getNormRate(rateColMap.year1, r);
            let rM13 = getNormRate(rateColMap.m13, r);
            let rY2 = getNormRate(rateColMap.year2, r);
            let rY3 = getNormRate(rateColMap.year3, r);
            let rTot = getNormRate(rateColMap.total, r);

            // 회사별 수수료 지급 정책 정밀 계산
            if (category === '생명보험') {
                if (sName === '한화생명' || sName === 'KB라이프') {
                    // 2차년계 전체를 13차월에 선지급
                    rM13 = rY2;
                } else if (sName === '교보생명') {
                    // 1차년계 전체 익월 선지급
                    rFirst = rY1;
                    // 13회計 (Col U)
                    rM13 = getNormRate('U', r);
                    // 3차년計 (Col AO)
                    rY3 = getNormRate('AO', r);
                    if (rTot === 0 || Math.abs(rTot - (rY1 + rY2 + rY3)) > 5) {
                        rTot = Math.round((rY1 + rY2 + rY3) * 100) / 100;
                    }
                } else if (sName === '농협생명') {
                    // 성과수수료(Col M) 13차월 지급 + 계약관리수수료(Col L) 50% 13차월 선지급
                    const pCol = nhPerfCol || 'M';
                    const mCol = nhMgmtCol || 'L';
                    const rM = getNormRate(pCol, r);
                    const rL = getNormRate(mCol, r);
                    rM13 = Math.round((rM + (rL * 0.5)) * 100) / 100;
                } else if (sName === '동양생명') {
                    // 2차년계의 50%는 13차월에 선지급, 나머지 50%는 19~24회차 분급
                    if (rY2 > 0) rM13 = Math.round((rY2 * 0.5) * 100) / 100;
                } else if (sName === '라이나생명') {
                    // 계약관리(H or I) / 12 + 유지성과(J) / 6
                    const rH = getNormRate('H', r);
                    const rI = getNormRate('I', r);
                    const rMgmt = rH > 0 ? rH : rI;
                    const rJ = getNormRate('J', r);
                    rM13 = Math.round(((rMgmt / 12.0) + (rJ / 6.0)) * 100) / 100;
                } else if (sName === '미래에셋') {
                    // 계약관리(P) + 계약유지(Q) / 12
                    const rP = getNormRate('P', r);
                    const rQ = getNormRate('Q', r);
                    rM13 = Math.round((rP + (rQ / 12.0)) * 100) / 100;
                } else if (sName === '삼성생명') {
                    // 고능률보너스(헤더 탐색, 없으면 V/W) + 계약관리커미션(헤더 탐색, 없으면 Q~U) * 0.5
                    let rBonus = 0.0;
                    samsungBonusCols.forEach(bc => {
                        const val = getNormRate(bc, r);
                        if (val > 0) rBonus += val;
                    });
                    if (rBonus === 0) {
                        const valW = getNormRate('W', r);
                        const valV = getNormRate('V', r);
                        rBonus = valW > 0 ? valW : valV;
                    }
                    let rMgmt = 0.0;
                    for (let mc of samsungMgmtCols) {
                        const val = getNormRate(mc, r);
                        if (val > 0) { rMgmt = val; break; }
                    }
                    if (rMgmt === 0) {
                        for (let mc of ['Q', 'R', 'S', 'T', 'U']) {
                            const val = getNormRate(mc, r);
                            if (val > 0) { rMgmt = val; break; }
                        }
                    }
                    rM13 = Math.round((rBonus + (rMgmt * 0.5)) * 100) / 100;
                } else if (sName === '신한라이프') {
                    // 계약관리(N~P) + 효율수수료(Q~T) / 12
                    let rMgmt = 0.0;
                    for (let mc of ['N', 'O', 'P']) {
                        const val = getNormRate(mc, r);
                        if (val > 0) { rMgmt = val; break; }
                    }
                    let rEff = 0.0;
                    for (let ec of ['Q', 'R', 'S', 'T']) {
                        const val = getNormRate(ec, r);
                        if (val > 0) rEff += val;
                    }
                    rM13 = Math.round((rMgmt + (rEff / 12.0)) * 100) / 100;
                } else if (sName === '카디프생명') {
                    // 1차년계 전체 익월 선지급
                    rFirst = rY1;
                    // 보장성(M) + 저축성(Y2 - M) / 12
                    const rM = getNormRate('M', r);
                    const rSavings = Math.max(0.0, rY2 - rM);
                    rM13 = Math.round((rM + (rSavings / 12.0)) * 100) / 100;
                } else if (sName === '하나생명') {
                    // 1차년계 전체 익월 선지급
                    rFirst = rY1;
                    // 2차년계 전체 13차월 선지급
                    rM13 = rY2;
                    if (rowOpts['납기'] && /^\d+$/.test(rowOpts['납기'])) {
                        rowOpts['납기'] = `${rowOpts['납기']}년납`;
                    }
                } else if (sName === '흥국생명') {
                    // 2차년계를 13~24회차까지 균등 분할 분급
                    if (rY2 > 0) rM13 = Math.round((rY2 / 12.0) * 100) / 100;
                } else if (sName === 'ABL생명') {
                    // 13차월은 2차년계 균등 분급
                    if (rY2 > 0) rM13 = Math.round((rY2 / 12.0) * 100) / 100;
                    const valI = getNormRate('I', r);
                    const valJ = getNormRate('J', r);
                    const valN = getNormRate('N', r);
                    if (valI > 0 && valJ > 0) {
                        rFirst = Math.round(((valI * 0.95) + valJ) * 100) / 100;
                        rY1 = Math.round(((valI * 0.95) + valJ + (valN * 0.95)) * 100) / 100;
                        rTot = Math.round((rY1 + rY2 + rY3) * 100) / 100;
                    }
                } else if (sName === 'DB생명') {
                    // 성과보너스(Col O) 13차월 선지급 + 신계약관리(Col N) 13~24회차 분급
                    const bCol = dbBonusCol || 'O';
                    const mCol = dbMgmtCol || 'N';
                    const valN = getNormRate(mCol, r);
                    const valO = getNormRate(bCol, r);
                    rM13 = Math.round((valO + (valN / 12.0)) * 100) / 100;
                } else if (sName === 'IBK연금') {
                    // 2차년계를 13~24회차까지 균등 분할 분급
                    if (rY2 > 0) rM13 = Math.round((rY2 / 12.0) * 100) / 100;
                } else if (sName === 'KDB생명') {
                    // 익월計 / 1차년계 전체를 1회차(익월)에 지급
                    rFirst = rY1;
                    // 2차년계를 13~24회차까지 균등 분할 분급
                    if (rY2 > 0) rM13 = Math.round((rY2 / 12.0) * 100) / 100;
                }
            } else if (category === '손해보험') {
                if (sName === 'DB손보' || sName === 'KB손보') {
                    if (rM13 > 0) rM13 = Math.round((rM13 / 2.0) * 100) / 100;
                } else if (sName === '농협손보' || sName === '삼성화재' || sName === '현대해상' || sName === '흥국화재') {
                    if (rM13 > 0) rM13 = Math.round((rM13 / 3.0) * 100) / 100;
                }
                if (rM13 === 0 && rY2 > 0) {
                    rM13 = Math.round((rY2 / 12.0) * 100) / 100;
                }
            }

            if (rTot === 0 && (rY1 > 0 || rY2 > 0)) {
                rTot = Math.round((rY1 + rY2 + rY3) * 100) / 100;
            }
            if (rY1 === 0 && rFirst > 0) {
                rY1 = rFirst;
            }
            if (rM13 === 0 && rY2 > 0) {
                rM13 = Math.round((rY2 / 12.0) * 100) / 100;
            }

            dataRows.push({
                product: lastProduct.replace(/[\r\n]+/g, ' ').trim(),
                options: rowOpts,
                rates: {
                    first: rFirst,
                    year1: rY1,
                    m13:   rM13,
                    year2: rY2,
                    year3: rY3,
                    total: rTot
                }
            });
        }

        if (dataRows.length > 0) {
            companyData[sName] = dataRows;
        }
    });

    return companyData;
}

/**
 * 엑셀 파싱 및 백엔드 저장 실행
 */
async function executeFeeExcelUpload() {
    const monthInput = document.getElementById('ft-upload-month');
    const month = (monthInput ? monthInput.value : '').trim();
    if (!month || month.length < 6) {
        alert('올바른 적용 기준월(예: 2026.09)을 입력해 주세요.');
        return;
    }

    const nonLifeFileInput = document.getElementById('ft-file-nonlife');
    const lifeFileInput = document.getElementById('ft-file-life');

    const hasNonLife = nonLifeFileInput && nonLifeFileInput.files && nonLifeFileInput.files.length > 0;
    const hasLife = lifeFileInput && lifeFileInput.files && lifeFileInput.files.length > 0;

    if (!hasNonLife && !hasLife) {
        alert('손해보험 또는 생명보험 엑셀 파일을 최소 1개 이상 선택해 주세요.');
        return;
    }

    const statusEl = document.getElementById('ft-upload-status');
    const btn = document.getElementById('ft-upload-submit-btn');

    const setStatus = (msg, isError = false) => {
        if (!statusEl) return;
        statusEl.classList.remove('hidden', 'bg-red-50', 'text-red-600', 'bg-blue-50', 'text-blue-600', 'bg-emerald-50', 'text-emerald-700');
        if (isError) {
            statusEl.classList.add('bg-red-50', 'text-red-600');
        } else {
            statusEl.classList.add('bg-blue-50', 'text-blue-600');
        }
        statusEl.innerHTML = msg;
    };

    btn.disabled = true;
    btn.classList.add('opacity-50', 'cursor-not-allowed');

    try {
        if (typeof XLSX === 'undefined') {
            throw new Error('SheetJS(XLSX) 라이브러리가 로드되지 않았습니다.');
        }

        const readFileAsArrayBuffer = (file) => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsArrayBuffer(file);
            });
        };

        const resultCategories = (FEE_TABLE_DATA && FEE_TABLE_DATA.categories) ? { ...FEE_TABLE_DATA.categories } : { "손해보험": {}, "생명보험": {} };

        // 1. 손해보험 파싱
        if (hasNonLife) {
            setStatus('손해보험 엑셀 파일을 분석하고 있습니다...');
            const buf = await readFileAsArrayBuffer(nonLifeFileInput.files[0]);
            const wb = XLSX.read(buf, { type: 'array' });
            resultCategories['손해보험'] = parseFeeWorkbook(wb, '손해보험');
        }

        // 2. 생명보험 파싱
        if (hasLife) {
            setStatus('생명보험 엑셀 파일을 분석하고 있습니다...');
            const buf = await readFileAsArrayBuffer(lifeFileInput.files[0]);
            const wb = XLSX.read(buf, { type: 'array' });
            resultCategories['생명보험'] = parseFeeWorkbook(wb, '생명보험');
        }

        const totalNonLife = Object.keys(resultCategories['손해보험'] || {}).length;
        const totalLife = Object.keys(resultCategories['생명보험'] || {}).length;

        setStatus(`구글 드라이브에 저장 중입니다... (손보 ${totalNonLife}개사, 생보 ${totalLife}개사)`);

        const payload = {
            month: month,
            updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
            categories: resultCategories
        };

        const res = await callApi('saveFeeTableData', month, payload);

        if (res && res.success) {
            setStatus(`<span class="text-emerald-700 font-bold">✓ ${res.message || '성공적으로 저장되었습니다.'}</span>`);
            setTimeout(() => {
                closeFeeExcelUploadModal();
                feeTableState.month = month;
                feeTableAvailableMonths = []; // 캐시 초기화
                loadFeeTableData(month, true);
            }, 1200);
        } else {
            throw new Error(res?.message || '구글 드라이브 저장에 실패했습니다.');
        }
    } catch (err) {
        console.error('executeFeeExcelUpload error:', err);
        setStatus(`오류: ${err.message || err.toString()}`, true);
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}
