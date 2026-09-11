/**
 * ==============================================================================
 * 파트너스 보드 - 수수료 예시표 조회 시스템 (script_fee_table.js)
 * - 손해보험(12개사) / 생명보험(17개사) 통합 지원
 * - 13차월 포함 반응형 요약 카드 및 월 보험료 원화 환산 시뮬레이터
 * - 관리자/지사대표 전용 지급율 조정 컨트롤 (일반 사용자에게는 지급율 UI 완전 숨김)
 * ==============================================================================
 */

var feeTableState = {
    category: '손해보험', // '손해보험' | '생명보험'
    company: 'DB손보',
    searchKeyword: '',
    selectedProduct: '',
    selectedOptions: {},
    premium: 100000, // 기본 월납 보험료 100,000원
    overrideRate: null // 관리자/지사대표가 조정한 지급율 (null이면 자동 계산)
};

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
 * 수수료 예시표 메인 뷰 렌더링
 */
function renderFeeTableView() {
    const container = document.getElementById('main-view');
    if (!container) return;

    // 데이터 검증
    if (typeof FEE_TABLE_DATA === 'undefined' || !FEE_TABLE_DATA.categories) {
        container.innerHTML = `
            <div class="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100 max-w-lg mx-auto mt-12">
                <div class="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                </div>
                <h3 class="font-bold text-gray-800 text-lg mb-2">수수료 예시표 데이터를 불러올 수 없습니다</h3>
                <p class="text-sm text-gray-500 mb-6">데이터 파일(fee_data_202609.js)이 준비되지 않았습니다. 관리자에게 문의하세요.</p>
                <button onclick="navigate('home')" class="px-6 py-2.5 bg-gray-900 text-white font-medium rounded-xl text-sm shadow-md hover:bg-black transition">홈으로 돌아가기</button>
            </div>
        `;
        return;
    }

    const categories = FEE_TABLE_DATA.categories;
    const catCompanies = categories[feeTableState.category] || {};
    const companyList = Object.keys(catCompanies);

    // 유효한 보험사 선택 보장
    if (!catCompanies[feeTableState.company] && companyList.length > 0) {
        feeTableState.company = companyList[0];
        feeTableState.selectedProduct = '';
        feeTableState.selectedOptions = {};
    }

    const currentRows = catCompanies[feeTableState.company] || [];

    // 유효한 상품 목록 추출
    const productMap = {};
    currentRows.forEach(row => {
        if (row.product) {
            if (!productMap[row.product]) productMap[row.product] = [];
            productMap[row.product].push(row);
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

    // 옵션 키 목록 추출 (예: ['구분', '만기', '납기'])
    const optionKeys = [];
    selectedProdRows.forEach(row => {
        if (row.options) {
            Object.keys(row.options).forEach(k => {
                if (!optionKeys.includes(k)) optionKeys.push(k);
            });
        }
    });

    // 기본 옵션 선택 보장
    if (selectedProdRows.length > 0) {
        optionKeys.forEach(k => {
            if (!feeTableState.selectedOptions[k]) {
                const firstVal = selectedProdRows[0].options ? selectedProdRows[0].options[k] : '';
                if (firstVal) feeTableState.selectedOptions[k] = firstVal;
            }
        });
    }

    // 조건에 가장 잘 일치하는 단일 데이터 행 찾기
    let matchedRow = selectedProdRows.find(row => {
        if (!row.options) return true;
        for (let k of optionKeys) {
            if (feeTableState.selectedOptions[k] && row.options[k] !== feeTableState.selectedOptions[k]) {
                return false;
            }
        }
        return true;
    });

    if (!matchedRow && selectedProdRows.length > 0) {
        matchedRow = selectedProdRows[0];
    }

    // 수수료율 및 원화 금액 계산
    const currentRate = getEffectiveFeeRate();
    const multiplier = currentRate / 100.0;
    const premium = feeTableState.premium || 100000;

    const baseRates = matchedRow ? matchedRow.rates : { first: 0, year1: 0, m13: 0, year2: 0, year3: 0, total: 0 };
    
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
    const isManager = isBranchRepAny() || isAdminAny();

    container.innerHTML = `
        <div class="space-y-6 pb-20 max-w-7xl mx-auto animate-fadeIn">
            
            <!-- 1. Header & Quick Controls -->
            <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                    <div class="flex items-center gap-3 mb-2">
                        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                        </div>
                        <div>
                            <h2 class="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                                수수료 예시표
                                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 tracking-normal">${FEE_TABLE_DATA.month} 기준</span>
                            </h2>
                            <p class="text-xs sm:text-sm text-slate-500">보험사 및 상품별 실수령 수수료율과 예상 수령액을 실시간으로 확인하세요.</p>
                        </div>
                    </div>
                </div>

                <!-- 관리자/지사대표 전용 지급율 조정 컨트롤 (일반 사용자에게는 완전히 숨김!) -->
                ${isManager ? `
                <div class="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 w-full lg:w-auto min-w-[320px] shadow-xs">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
                            지급율 시뮬레이션 <span class="text-[10px] font-normal text-slate-400">(관리자 전용)</span>
                        </span>
                        <span class="text-sm font-black text-primary" id="ft-payout-display">${currentRate.toFixed(1)}%</span>
                    </div>
                    <div class="flex items-center gap-3">
                        <input type="range" min="50" max="100" step="0.5" value="${currentRate}" id="ft-payout-slider" class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary">
                        <input type="number" min="50" max="100" step="0.5" value="${currentRate}" id="ft-payout-input" class="w-16 px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center text-slate-800 focus:outline-none focus:border-primary">
                    </div>
                    <div class="flex items-center justify-between gap-1 mt-2">
                        <button onclick="setFeePayoutRate(80)" class="px-2 py-0.5 text-[10px] font-semibold rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">80%</button>
                        <button onclick="setFeePayoutRate(84)" class="px-2 py-0.5 text-[10px] font-semibold rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">84%</button>
                        <button onclick="setFeePayoutRate(88)" class="px-2 py-0.5 text-[10px] font-semibold rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">88%</button>
                        <button onclick="setFeePayoutRate(100)" class="px-2 py-0.5 text-[10px] font-semibold rounded bg-white border border-slate-200 text-slate-600 hover:bg-slate-100">100%</button>
                        <button onclick="resetFeePayoutRate()" class="px-2 py-0.5 text-[10px] font-semibold rounded bg-orange-50 border border-orange-200 text-primary hover:bg-orange-100">내지급율</button>
                    </div>
                </div>
                ` : ''}
            </div>

            <!-- 2. Category Tab (손보 vs 생보) -->
            <div class="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
                <button onclick="switchFeeCategory('손해보험')" class="px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${feeTableState.category === '손해보험' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}">
                    손해보험 <span class="text-xs font-normal opacity-70">(${Object.keys(categories['손해보험'] || {}).length})</span>
                </button>
                <button onclick="switchFeeCategory('생명보험')" class="px-6 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 ${feeTableState.category === '생명보험' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}">
                    생명보험 <span class="text-xs font-normal opacity-70">(${Object.keys(categories['생명보험'] || {}).length})</span>
                </button>
            </div>

            <!-- 3. Company Chips (가로 스크롤) -->
            <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                ${companyList.map(comp => {
                    const active = (feeTableState.company === comp);
                    return `
                        <button onclick="switchFeeCompany('${comp}')" class="px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all duration-200 ${active ? 'bg-primary text-white shadow-md shadow-orange-500/25 scale-[1.02]' : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-100'}">
                            ${comp}
                        </button>
                    `;
                }).join('')}
            </div>

            <!-- 4. Product Search & Dynamic Condition Selector -->
            <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 space-y-6">
                <!-- Search Input & Product Selector -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-2">상품 검색 (키워드/초성)</label>
                        <div class="relative">
                            <input type="text" id="ft-product-search" value="${feeTableState.searchKeyword}" placeholder="상품명을 입력하세요 (예: 중증케어, 건강보험 등)" class="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:border-primary focus:bg-white transition" oninput="handleFeeProductSearch(this.value)">
                            <div class="absolute left-3.5 top-3.5 text-slate-400 pointer-events-none">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                            </div>
                            ${feeTableState.searchKeyword ? `
                                <button onclick="clearFeeProductSearch()" class="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                </button>
                            ` : ''}
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 mb-2">선택된 상품 (${filteredProducts.length}개 검색됨)</label>
                        <select id="ft-product-select" class="w-full py-3 px-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:border-primary focus:bg-white transition" onchange="selectFeeProduct(this.value)">
                            ${filteredProducts.map(p => `
                                <option value="${p}" ${p === feeTableState.selectedProduct ? 'selected' : ''}>${p}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <!-- Dynamic Option Selector Chips (만기, 납기, 구분 등) -->
                ${optionKeys.length > 0 ? `
                <div class="pt-4 border-t border-slate-100 space-y-4">
                    ${optionKeys.map(optKey => {
                        const valSet = [];
                        selectedProdRows.forEach(r => {
                            if (r.options && r.options[optKey]) {
                                const val = r.options[optKey];
                                if (!valSet.includes(val)) valSet.push(val);
                            }
                        });
                        if (valSet.length === 0) return '';
                        
                        const curVal = feeTableState.selectedOptions[optKey] || valSet[0];

                        return `
                            <div>
                                <span class="text-xs font-bold text-slate-400 block mb-2">${optKey} 선택</span>
                                <div class="flex flex-wrap gap-2">
                                    ${valSet.map(v => {
                                        const selected = (v === curVal);
                                        return `
                                            <button onclick="setFeeOption('${optKey}', '${v}')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 ${selected ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'}">
                                                ${v}
                                            </button>
                                        `;
                                    }).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                ` : ''}
            </div>

            <!-- 5. Monthly Premium Simulator Bar -->
            <div class="bg-gradient-to-r from-slate-900 to-indigo-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div class="space-y-1">
                    <span class="text-xs font-extrabold uppercase tracking-widest text-orange-400">Monthly Premium Simulator</span>
                    <h3 class="text-xl sm:text-2xl font-black">월 예상 보험료 입력</h3>
                    <p class="text-xs text-slate-300">원하시는 월납 보험료를 입력하시면 실수령 예상액으로 즉시 자동 환산됩니다.</p>
                </div>
                <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
                    <div class="relative min-w-[200px]">
                        <input type="text" id="ft-premium-input" value="${premium.toLocaleString('ko-KR')}" class="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-2xl text-lg font-black text-white text-right focus:outline-none focus:border-orange-400 focus:bg-white/20 transition pr-8" oninput="handleFeePremiumInput(this.value)">
                        <span class="absolute right-3 top-3.5 text-sm font-bold text-slate-300">원</span>
                    </div>
                    <div class="grid grid-cols-4 sm:flex gap-1.5">
                        <button onclick="setFeePremium(100000)" class="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition">10만</button>
                        <button onclick="setFeePremium(200000)" class="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition">20만</button>
                        <button onclick="setFeePremium(300000)" class="px-3 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition">30만</button>
                        <button onclick="addFeePremium(50000)" class="px-3 py-2 bg-orange-500/30 hover:bg-orange-500/40 text-orange-300 border border-orange-400/30 rounded-xl text-xs font-bold transition">+5만</button>
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
                    
                    <!-- Card 1: 1회차 (익월) -->
                    <div class="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:border-slate-200 transition">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-extrabold text-slate-500">1회차 (익월)</span>
                            <span class="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold">1</span>
                        </div>
                        <div>
                            <p class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">${calcRates.first.toFixed(1)}<span class="text-sm font-bold text-slate-400 ml-0.5">%</span></p>
                            <p class="text-xs sm:text-sm font-bold text-blue-600 mt-1">${calcAmounts.first.toLocaleString('ko-KR')} <span class="text-[10px] text-slate-400">원</span></p>
                        </div>
                    </div>

                    <!-- Card 2: 1차년도 합계 -->
                    <div class="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:border-slate-200 transition">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-extrabold text-slate-500">1차년도 합계</span>
                            <span class="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-bold">Y1</span>
                        </div>
                        <div>
                            <p class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">${calcRates.year1.toFixed(1)}<span class="text-sm font-bold text-slate-400 ml-0.5">%</span></p>
                            <p class="text-xs sm:text-sm font-bold text-indigo-600 mt-1">${calcAmounts.year1.toLocaleString('ko-KR')} <span class="text-[10px] text-slate-400">원</span></p>
                        </div>
                    </div>

                    <!-- Card 3: 13차월 (★ 2차년도 앞 추가!) -->
                    <div class="bg-gradient-to-br from-amber-50/50 to-orange-50/30 rounded-3xl p-5 border border-orange-100 shadow-sm flex flex-col justify-between hover:border-orange-200 transition">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-extrabold text-orange-800">13차월</span>
                            <span class="w-6 h-6 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] font-bold">13M</span>
                        </div>
                        <div>
                            <p class="text-xl sm:text-2xl font-black text-orange-950 tracking-tight">${calcRates.m13.toFixed(1)}<span class="text-sm font-bold text-orange-400 ml-0.5">%</span></p>
                            <p class="text-xs sm:text-sm font-bold text-orange-600 mt-1">${calcAmounts.m13.toLocaleString('ko-KR')} <span class="text-[10px] text-slate-400">원</span></p>
                        </div>
                    </div>

                    <!-- Card 4: 2차년도 합계 -->
                    <div class="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:border-slate-200 transition">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-extrabold text-slate-500">2차년도 합계</span>
                            <span class="w-6 h-6 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-[10px] font-bold">Y2</span>
                        </div>
                        <div>
                            <p class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">${calcRates.year2.toFixed(1)}<span class="text-sm font-bold text-slate-400 ml-0.5">%</span></p>
                            <p class="text-xs sm:text-sm font-bold text-purple-600 mt-1">${calcAmounts.year2.toLocaleString('ko-KR')} <span class="text-[10px] text-slate-400">원</span></p>
                        </div>
                    </div>

                    <!-- Card 5: 3차년도 합계 (생보사 전용) -->
                    ${isLife ? `
                    <div class="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm flex flex-col justify-between hover:border-slate-200 transition">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-extrabold text-slate-500">3차년도 합계</span>
                            <span class="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold">Y3</span>
                        </div>
                        <div>
                            <p class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">${calcRates.year3.toFixed(1)}<span class="text-sm font-bold text-slate-400 ml-0.5">%</span></p>
                            <p class="text-xs sm:text-sm font-bold text-emerald-600 mt-1">${calcAmounts.year3.toLocaleString('ko-KR')} <span class="text-[10px] text-slate-400">원</span></p>
                        </div>
                    </div>
                    ` : ''}

                    <!-- Card 6: 총계 (강조 카드) -->
                    <div class="bg-gradient-to-tr from-primary to-orange-400 rounded-3xl p-5 text-white shadow-lg shadow-orange-500/25 flex flex-col justify-between ${!isLife ? 'col-span-2 sm:col-span-1' : ''}">
                        <div class="flex items-center justify-between mb-3">
                            <span class="text-xs font-black uppercase tracking-wider text-orange-100">총 수령액 합계</span>
                            <span class="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold">TOTAL</span>
                        </div>
                        <div>
                            <p class="text-2xl sm:text-3xl font-black tracking-tight">${calcRates.total.toFixed(1)}<span class="text-base font-bold text-orange-100 ml-0.5">%</span></p>
                            <p class="text-sm sm:text-base font-black text-white mt-1 drop-shadow-xs">${calcAmounts.total.toLocaleString('ko-KR')} <span class="text-xs font-medium text-orange-100">원</span></p>
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

    // 이벤트 리스너 바인딩 (관리자 슬라이더)
    if (isManager) {
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

/**
 * 상품 검색 인풋
 */
function handleFeeProductSearch(val) {
    feeTableState.searchKeyword = val;
    renderFeeTableView();
    const input = document.getElementById('ft-product-search');
    if (input) {
        input.focus();
        input.selectionStart = input.selectionEnd = input.value.length;
    }
}

/**
 * 검색어 클리어
 */
function clearFeeProductSearch() {
    feeTableState.searchKeyword = '';
    renderFeeTableView();
}

/**
 * 상품 선택
 */
function selectFeeProduct(prod) {
    feeTableState.selectedProduct = prod;
    feeTableState.selectedOptions = {};
    renderFeeTableView();
}

/**
 * 동적 옵션 설정 (만기, 납기 등)
 */
function setFeeOption(key, val) {
    feeTableState.selectedOptions[key] = val;
    renderFeeTableView();
}

/**
 * 월 보험료 입력
 */
function handleFeePremiumInput(val) {
    const raw = String(val).replace(/[^0-9]/g, '');
    const num = parseInt(raw, 10);
    feeTableState.premium = isNaN(num) ? 0 : num;
    renderFeeTableView();
    const input = document.getElementById('ft-premium-input');
    if (input) {
        input.focus();
        input.selectionStart = input.selectionEnd = input.value.length;
    }
}

/**
 * 월 보험료 프리셋
 */
function setFeePremium(amt) {
    feeTableState.premium = amt;
    renderFeeTableView();
}

/**
 * 월 보험료 추가
 */
function addFeePremium(delta) {
    feeTableState.premium = (feeTableState.premium || 0) + delta;
    renderFeeTableView();
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
