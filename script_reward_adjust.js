        // === Section: Reward Adjustment View ===
        function createRewardAdjustView() {
            const container = document.createElement('div');
            container.className = 'space-y-6';

            // 로컬 상태
            let listData = [];
            let originalMap = {}; // key -> originalRow
            let editedItems = {}; // key -> updatedFields
            let userList = [];
            let allUserList = []; // 퇴사자 포함 전체 사용자 목록
            let defaultsList = [];
            let selectedRows = new Set();
            
            // 엑셀 파싱 원천 데이터 임시 보관소
            let uploadedParsedRows = []; 

            // 202510부터 전월(현재 일 기준)까지의 마감월 목록 동적 생성 헬퍼
            function getAdjMonthsList() {
                const months = [];
                const startYear = 2025;
                const startMonth = 10;
                
                const now = new Date();
                // 전월 계산
                const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const endYear = prevDate.getFullYear();
                const endMonth = prevDate.getMonth() + 1;
                
                let currYear = startYear;
                let currMonth = startMonth;
                
                while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
                    const mStr = String(currMonth).padStart(2, '0');
                    months.push(`${currYear}${mStr}`);
                    
                    currMonth++;
                    if (currMonth > 12) {
                        currMonth = 1;
                        currYear++;
                    }
                }
                // 최신 월(전월)이 가장 상단에 오도록 내림차순 정렬
                return months.reverse();
            }

            const adjMonths = getAdjMonthsList();
            const defaultSelectedMonth = adjMonths[0] || ''; // 내림차순 첫 항목 = 전월

            // 천원 단위 쉼표 포맷 헬퍼
            function formatNumberWithCommas(val) {
                if (val === undefined || val === null || val === '') return '0';
                if (val === '-') return '-';
                let str = String(val).trim();
                let isNegative = str.startsWith('-');
                let clean = str.replace(/[^0-9]/g, '');
                if (!clean) return isNegative ? '-' : '0';
                let formatted = Number(clean).toLocaleString('ko-KR');
                return isNegative ? '-' + formatted : formatted;
            }

            // 음수 서식화 헬퍼 함수 (음수일 경우 text-rose-600 font-bold 스타일 적용)
            function formatMoneyAdj(val, defaultClass = 'text-gray-800') {
                if (val === '' || val === null || val === undefined) return '-';
                const num = Number(val);
                if (isNaN(num)) return '-';
                const isNeg = num < 0;
                const colorClass = isNeg ? 'text-rose-600 font-bold' : defaultClass;
                return `<span class="tabular-nums ${colorClass}">${num.toLocaleString('ko-KR')}</span>`;
            }

            function formatRateAdj(val, defaultClass = 'text-indigo-600') {
                if (val === '' || val === null || val === undefined) return '-';
                const num = Number(val);
                if (isNaN(num)) return '-';
                const pct = Number((num * 100).toFixed(2));
                const isNeg = pct < 0;
                const colorClass = isNeg ? 'text-rose-600 font-bold' : defaultClass;
                return `<span class="tabular-nums ${colorClass}">${pct}%</span>`;
            }

            function updateInputNegativeColor(inputEl, val) {
                if (!inputEl) return;
                const str = String(val !== undefined && val !== null ? val : '').trim();
                const isNeg = str.startsWith('-') || Number(str.replace(/,/g, '')) < 0;
                if (isNeg) {
                    inputEl.classList.add('text-rose-600');
                    inputEl.classList.remove('text-gray-800', 'text-slate-700', 'text-slate-800');
                } else {
                    inputEl.classList.remove('text-rose-600');
                    inputEl.classList.add('text-gray-800');
                }
            }

            // 1. 헤더 영역 및 검색 필터 패널
            container.innerHTML = `
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
                    <!-- 최상단 헤더: 제목(좌측) + 파일 업로드 영역 & 내보내기 버튼(우측) -->
                    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div>
                            <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <span class="w-1.5 h-5 bg-primary rounded-full block"></span>
                                시상 조정
                            </h2>
                            <p class="text-xs text-gray-500 mt-1">시상 지급 대상을 검색/변경하고 비율 및 지급액을 조정합니다. (지사대표 전용)</p>
                        </div>
                        <div class="flex flex-col sm:flex-row items-center gap-2.5 flex-shrink-0">
                            <div id="dropZone" class="border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-orange-50/5 rounded-xl px-3.5 py-2 text-center cursor-pointer transition flex items-center justify-center gap-2 h-[42px] w-full sm:w-auto">
                                <svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                <span class="text-xs text-gray-600 font-bold whitespace-nowrap">엑셀 업로드 (.xlsx)</span>
                                <input type="file" id="excelFilesInput" multiple accept=".xlsx" class="hidden">
                            </div>
                            <button id="exportAdjustBtn" class="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-1.5 h-[42px] whitespace-nowrap">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                조정내용 파일로 내보내기
                            </button>
                        </div>
                    </div>

                    <!-- 업로드 파일 목록 및 전송 진행 바 -->
                    <div id="uploadProgressSection" class="hidden space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200/50">
                        <div class="flex items-center justify-between text-xs font-bold text-gray-600">
                            <span id="progressStatusText">대기 중...</span>
                            <span id="progressPercentText">0%</span>
                        </div>
                        <div class="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                            <div id="progressBar" class="bg-primary h-full transition-all duration-200" style="width: 0%;"></div>
                        </div>
                    </div>

                    <!-- 검색 필터바 -->
                    <div class="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200/50">
                        <!-- 1행: 시상종류 세그먼트 + 구분 세그먼트(가까이 배치) & 시상조정 디폴트값 적용하기 버튼(우측 정렬) -->
                        <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-gray-200/60">
                            <div class="flex flex-wrap items-center gap-3 sm:gap-4">
                                <!-- 시상종류 라디오 그룹 -->
                                <div class="flex items-center gap-1.5">
                                    <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                                        <span class="w-1.5 h-3 bg-primary rounded-sm inline-block"></span>
                                        시상종류
                                    </label>
                                    <div id="adjRewardTypeGroup" class="inline-flex flex-wrap p-1 bg-gray-200/60 rounded-xl gap-0.5 border border-gray-200/80">
                                        <label class="cursor-pointer select-none">
                                            <input type="radio" name="adjRewardTypeRadio" value="2차년인센" class="sr-only peer" checked>
                                            <span class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all inline-block text-gray-600 hover:text-gray-900 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-sm">2차년인센</span>
                                        </label>
                                        <label class="cursor-pointer select-none">
                                            <input type="radio" name="adjRewardTypeRadio" value="생보법인" class="sr-only peer">
                                            <span class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all inline-block text-gray-600 hover:text-gray-900 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-sm">생보법인</span>
                                        </label>
                                        <label class="cursor-pointer select-none">
                                            <input type="radio" name="adjRewardTypeRadio" value="손보법인" class="sr-only peer">
                                            <span class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all inline-block text-gray-600 hover:text-gray-900 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-sm">손보법인</span>
                                        </label>
                                        <label class="cursor-pointer select-none">
                                            <input type="radio" name="adjRewardTypeRadio" value="생보개인" class="sr-only peer">
                                            <span class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all inline-block text-gray-600 hover:text-gray-900 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-sm">생보개인</span>
                                        </label>
                                        <label class="cursor-pointer select-none">
                                            <input type="radio" name="adjRewardTypeRadio" value="손보개인" class="sr-only peer">
                                            <span class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all inline-block text-gray-600 hover:text-gray-900 peer-checked:bg-primary peer-checked:text-white peer-checked:shadow-sm">손보개인</span>
                                        </label>
                                    </div>
                                </div>

                                <!-- 구분(지급/환수) 라디오 그룹 (시상종류 바로 오른편에 근접 배치) -->
                                <div class="flex items-center gap-1.5">
                                    <label class="text-[11px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                                        <span class="w-1.5 h-3 bg-secondary rounded-sm inline-block"></span>
                                        구분
                                    </label>
                                    <div id="adjPayRefundGroup" class="inline-flex p-1 bg-gray-200/60 rounded-xl gap-0.5 border border-gray-200/80">
                                        <label class="cursor-pointer select-none">
                                            <input type="radio" name="adjPayRefundRadio" value="전체" class="sr-only peer" checked>
                                            <span class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all inline-block text-gray-600 hover:text-gray-900 peer-checked:bg-secondary peer-checked:text-white peer-checked:shadow-sm">전체</span>
                                        </label>
                                        <label class="cursor-pointer select-none">
                                            <input type="radio" name="adjPayRefundRadio" value="지급" class="sr-only peer">
                                            <span class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all inline-block text-gray-600 hover:text-gray-900 peer-checked:bg-emerald-600 peer-checked:text-white peer-checked:shadow-sm">지급</span>
                                        </label>
                                        <label class="cursor-pointer select-none">
                                            <input type="radio" name="adjPayRefundRadio" value="환수" class="sr-only peer">
                                            <span class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all inline-block text-gray-600 hover:text-gray-900 peer-checked:bg-rose-600 peer-checked:text-white peer-checked:shadow-sm">환수</span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <!-- 우측 정렬: 시상조정 디폴트값 적용하기 버튼 -->
                            <div class="flex justify-end flex-shrink-0">
                                <button id="applyDefaultRatesBtn" class="w-full sm:w-auto px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center gap-1.5 h-[38px] whitespace-nowrap">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                    시상조정 디폴트값 적용하기
                                </button>
                            </div>
                        </div>

                        <!-- 2행: 상세 검색 조건 및 조회 버튼 -->
                        <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
                            <div>
                                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">마감월</label>
                                <select id="adjMonth" class="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition cursor-pointer">
                                    ${adjMonths.map(m => `<option value="${m}" ${m === defaultSelectedMonth ? 'selected' : ''}>${m}</option>`).join('')}
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">보험사</label>
                                <select id="adjCompany" class="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition cursor-pointer">
                                    <option value="전체">전체</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">소속</label>
                                <select id="adjBranch" class="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition cursor-pointer">
                                    <option value="전체">전체</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">모집인 (이름/사번)</label>
                                <input type="text" id="adjAgent" placeholder="전체" class="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition">
                            </div>
                            <div class="col-span-2 sm:col-span-2 md:col-span-1 flex justify-end">
                                <button id="adjSearchBtn" class="w-full px-5 py-2.5 bg-secondary hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition shadow-sm h-[38px]">
                                    조회하기
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 데이터 목록 카드 -->
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div class="flex items-center justify-between gap-4 mb-4">
                        <div class="flex items-center gap-2">
                            <span class="text-sm font-bold text-gray-700">검색 결과 <span id="adjResultCount" class="text-primary font-black ml-1">0</span>건</span>
                            <span id="unsavedBadge" class="hidden px-2.5 py-0.5 bg-yellow-100 text-yellow-800 font-bold rounded-full text-[10px]">저장되지 않은 변경사항 있음</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <button id="batchEditBtn" disabled class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold rounded-lg text-xs transition">
                                선택 일괄수정
                            </button>
                            <button id="batchEditAllBtn" disabled class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold rounded-lg text-xs transition">
                                전체 일괄수정
                            </button>
                            <button id="saveAdjustBtn" disabled class="px-4 py-1.5 bg-primary hover:bg-primaryHover disabled:opacity-50 text-white font-bold rounded-lg text-xs shadow-md shadow-orange-100 transition">
                                변경사항 저장
                            </button>
                        </div>
                    </div>

                    <!-- 테이블 컨테이너 -->
                    <div class="overflow-x-auto border border-gray-100 rounded-xl">
                        <table class="w-full text-left border-collapse text-[11px]">
                            <thead>
                                <tr class="bg-gray-50 border-b border-gray-100 text-gray-500 font-semibold select-none">
                                    <th class="p-3 text-center w-10"><input type="checkbox" id="selectAllCheckbox"></th>
                                    <th class="p-3">마감월</th>
                                    <th style="width: 100px; min-width: 100px; white-space: nowrap;" class="p-3">보험사</th>
                                    <th style="width: 75px; min-width: 75px; white-space: nowrap;" class="p-3">소속</th>
                                    <th style="width: 60px; min-width: 60px; white-space: nowrap;" class="p-3 text-center">구분</th>
                                    <th class="p-3">증권번호</th>
                                    <th style="width: 60px; min-width: 60px; white-space: nowrap;" class="p-3">계약자</th>
                                    <th id="thContractDate" style="width: 95px; min-width: 95px; white-space: nowrap;" class="p-3 font-mono cursor-pointer select-none hover:bg-gray-200/70 transition" title="클릭하여 오름차순/내림차순/정렬취소 토글">
                                        계약일 <span id="contractDateSortIcon" class="text-gray-400 font-bold ml-0.5">⇅</span>
                                    </th>
                                    <th class="p-3 text-center">회차</th>
                                    <th class="p-3 text-right">보험료</th>
                                    <th class="p-3">상품명</th>
                                    <th class="p-3">시상내용</th>
                                    <th class="p-3 text-right">시상금</th>
                                    <th class="p-3 text-center">시상률</th>
                                    <th class="p-3">지급대상자1</th>
                                    <th class="p-3 text-right">지급액1</th>
                                    <th class="p-3 text-center">지급비율1</th>
                                    <th class="p-3">지급대상자2</th>
                                    <th class="p-3 text-right">지급액2</th>
                                    <th class="p-3 text-center">지급비율2</th>
                                </tr>
                                <!-- 합계 행 1: 변경전 (배경색 일체화) -->
                                <tr id="trSummaryPrev" class="bg-slate-100/90 border-b border-slate-200 text-slate-700 font-bold select-none text-[11px]">
                                    <td colspan="12" class="p-2.5 text-center font-bold text-slate-600">합계 (변경전)</td>
                                    <td class="p-2.5 text-right font-black text-slate-800" id="sumPrevReward">-</td>
                                    <td class="p-2.5 text-center text-slate-400 font-normal">-</td>
                                    <td class="p-2.5 text-center text-slate-400 font-normal">-</td>
                                    <td class="p-2.5 text-right font-black text-slate-800" id="sumPrevPay1">-</td>
                                    <td class="p-2.5 text-center text-slate-400 font-normal">-</td>
                                    <td class="p-2.5 text-center text-slate-400 font-normal">-</td>
                                    <td class="p-2.5 text-right font-black text-slate-800" id="sumPrevPay2">-</td>
                                    <td class="p-2.5 text-center text-slate-400 font-normal">-</td>
                                </tr>
                                <!-- 합계 행 2: 변경후 (배경색 일체화) -->
                                <tr id="trSummaryCurr" class="bg-amber-50/80 border-b-2 border-slate-300 text-slate-800 font-bold select-none text-[11px]">
                                    <td colspan="12" class="p-2.5 text-center font-black text-amber-900">합계 (변경후)</td>
                                    <td class="p-2.5 text-right font-black text-amber-950" id="sumCurrReward">-</td>
                                    <td class="p-2.5 text-center text-slate-400 font-normal">-</td>
                                    <td class="p-2.5 text-center text-slate-400 font-normal">-</td>
                                    <td class="p-2.5 text-right font-black text-blue-900" id="sumCurrPay1">-</td>
                                    <td class="p-2.5 text-center text-slate-400 font-normal">-</td>
                                    <td class="p-2.5 text-center text-slate-400 font-normal">-</td>
                                    <td class="p-2.5 text-right font-black text-indigo-900" id="sumCurrPay2">-</td>
                                    <td class="p-2.5 text-center text-slate-400 font-normal">-</td>
                                </tr>
                            </thead>
                            <tbody id="adjTableBody" class="divide-y divide-gray-50">
                                <tr>
                                    <td colspan="20" class="p-8 text-center text-gray-400 font-medium">검색 조건 설정 후 [조회하기] 버튼을 눌러주세요.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            // DOM 요소 선택 및 라디오 그룹 바인딩
            const adjRewardType = {
                get value() {
                    const checked = container.querySelector('input[name="adjRewardTypeRadio"]:checked');
                    return checked ? checked.value : '2차년인센';
                },
                set value(val) {
                    const radio = container.querySelector(`input[name="adjRewardTypeRadio"][value="${val}"]`);
                    if (radio) {
                        radio.checked = true;
                        radio.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                },
                addEventListener(type, listener) {
                    container.querySelectorAll('input[name="adjRewardTypeRadio"]').forEach(r => {
                        r.addEventListener(type, listener);
                    });
                }
            };

            const adjPayRefund = {
                get value() {
                    const checked = container.querySelector('input[name="adjPayRefundRadio"]:checked');
                    return checked ? checked.value : '전체';
                },
                set value(val) {
                    const radio = container.querySelector(`input[name="adjPayRefundRadio"][value="${val}"]`);
                    if (radio) {
                        radio.checked = true;
                        radio.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                },
                addEventListener(type, listener) {
                    container.querySelectorAll('input[name="adjPayRefundRadio"]').forEach(r => {
                        r.addEventListener(type, listener);
                    });
                }
            };

            const adjMonth = container.querySelector('#adjMonth');
            const adjCompany = container.querySelector('#adjCompany');
            const adjBranch = container.querySelector('#adjBranch');
            const adjAgent = container.querySelector('#adjAgent');
            const adjSearchBtn = container.querySelector('#adjSearchBtn');
            const adjTableBody = container.querySelector('#adjTableBody');
            const adjResultCount = container.querySelector('#adjResultCount');
            const selectAllCheckbox = container.querySelector('#selectAllCheckbox');
            const batchEditBtn = container.querySelector('#batchEditBtn');
            const batchEditAllBtn = container.querySelector('#batchEditAllBtn');
            const saveAdjustBtn = container.querySelector('#saveAdjustBtn');
            const unsavedBadge = container.querySelector('#unsavedBadge');

            const thContractDate = container.querySelector('#thContractDate');
            const contractDateSortIcon = container.querySelector('#contractDateSortIcon');
            const sumPrevReward = container.querySelector('#sumPrevReward');
            const sumPrevPay1 = container.querySelector('#sumPrevPay1');
            const sumPrevPay2 = container.querySelector('#sumPrevPay2');
            const sumCurrReward = container.querySelector('#sumCurrReward');
            const sumCurrPay1 = container.querySelector('#sumCurrPay1');
            const sumCurrPay2 = container.querySelector('#sumCurrPay2');

            const dropZone = container.querySelector('#dropZone');
            const excelFilesInput = container.querySelector('#excelFilesInput');
            const applyDefaultRatesBtn = container.querySelector('#applyDefaultRatesBtn');
            const exportAdjustBtn = container.querySelector('#exportAdjustBtn');
            const uploadProgressSection = container.querySelector('#uploadProgressSection');
            const progressStatusText = container.querySelector('#progressStatusText');
            const progressPercentText = container.querySelector('#progressPercentText');
            const progressBar = container.querySelector('#progressBar');

            // 시상종류 변경 시 필터값 초기화
            adjRewardType.addEventListener('change', () => {
                adjCompany.innerHTML = '<option value="전체">전체</option>';
                adjBranch.innerHTML = '<option value="전체">전체</option>';
            });

            // 시상조정 디폴트값 적용하기 버튼 이벤트
            applyDefaultRatesBtn.addEventListener('click', async () => {
                if (listData.length === 0) {
                    alert('적용할 조회 데이터가 없습니다. 먼저 조회를 진행해 주세요.');
                    return;
                }

                const currentType = adjRewardType.value;
                if (!confirm(`'${currentType}' 시상에 대한 시상조정 디폴트값을 현재 조회된 목록(${listData.length}건)에 적용하시겠습니까?`)) {
                    return;
                }

                showLoading(true);
                try {
                    const res = await callApi('getRewardAdjustDefaults', state.user.staffId);
                    showLoading(false);

                    if (res.error || !res.success) {
                        alert('디폴트값을 가져오지 못했습니다: ' + (res.message || '네트워크 오류'));
                        return;
                    }

                    const defaults = res.list || [];
                    // 현재 시상종류에 해당하는 디폴트 설정 필터링
                    const currentTypeDefaults = defaults.filter(d => String(d['시상종류'] || '').trim() === currentType);

                    if (currentTypeDefaults.length === 0) {
                        alert(`'시상조정디폴트값' 시트에 '${currentType}' 시상종류에 대한 설정이 존재하지 않습니다.`);
                        return;
                    }

                    // 시상률 파싱 헬퍼 함수
                    function parseDefaultRate(val) {
                        if (val === undefined || val === null || val === '') return null;
                        let valStr = String(val).trim();
                        
                        // 1. '%' 문자가 명시적으로 포함된 경우 (예: "150%", "200%")
                        if (valStr.includes('%')) {
                            let num = parseFloat(valStr.replace(/%/g, ''));
                            return isNaN(num) ? null : num / 100;
                        }
                        
                        let num = parseFloat(valStr);
                        if (isNaN(num)) return null;
                        
                        // 2. 숫자로 10 이상인 경우 (예: 150, 200 등 % 없는 정수 표기)
                        if (num >= 10) {
                            return num / 100;
                        }
                        
                        // 3. 구글 스프레드시트 % 서식에 의해 1.5, 2.0, 0.5 등으로 반환된 경우
                        return num;
                    }

                    const isAdjustment = ['2차년인센', '생보법인', '손보법인'].includes(currentType);
                    let appliedCount = 0;

                    listData.forEach(row => {
                        const rowCompany = String(row['보험사'] || '').trim();
                        const rowBranch = String(row['소속2'] || '').trim();

                        // 4단계 우선순위 매칭
                        // 1. 특정 보험사 & 특정 소속
                        let matched = currentTypeDefaults.find(d => {
                            const c = String(d['보험사'] || '').trim();
                            const b = String(d['소속'] || '').trim();
                            return c === rowCompany && b === rowBranch;
                        });

                        // 2. 특정 보험사 & 전체 소속
                        if (!matched) {
                            matched = currentTypeDefaults.find(d => {
                                const c = String(d['보험사'] || '').trim();
                                const b = String(d['소속'] || '').trim();
                                return c === rowCompany && (b === '전체' || b === '');
                            });
                        }

                        // 3. 전체 보험사 & 특정 소속
                        if (!matched) {
                            matched = currentTypeDefaults.find(d => {
                                const c = String(d['보험사'] || '').trim();
                                const b = String(d['소속'] || '').trim();
                                return (c === '전체' || c === '') && b === rowBranch;
                            });
                        }

                        // 4. 전체 보험사 & 전체 소속
                        if (!matched) {
                            matched = currentTypeDefaults.find(d => {
                                const c = String(d['보험사'] || '').trim();
                                const b = String(d['소속'] || '').trim();
                                return (c === '전체' || c === '') && (b === '전체' || b === '');
                            });
                        }

                        if (matched) {
                            const defaultLeaderVal = String(matched['지급대상자1'] !== undefined ? matched['지급대상자1'] : (matched['지급대상자1명'] || '')).trim();
                            const defaultFpVal = String(matched['지급대상자2'] !== undefined ? matched['지급대상자2'] : (matched['지급대상자2명'] || '')).trim();
                            const targetRatio2 = parseDefaultRate(matched['시상률']);

                            const hasLeader = defaultLeaderVal !== '';
                            const hasFp = defaultFpVal !== '';
                            const hasRatio = targetRatio2 !== null;

                            // 3개 항목 중 하나라도 설정되어 있으면 적용
                            if (hasLeader || hasFp || hasRatio) {
                                const key = getRowKey(row);
                                if (!editedItems[key]) editedItems[key] = {};

                                const isRowRefund = String(row['지급/환수'] || row['구분'] || row['지급구분'] || '').includes('환수');
                                const premium = Number(row['보험료'] || 0);
                                const totalReward = isAdjustment ? Number(row['시상금'] || 0) : 0;
                                let rateFloat = Number(row['시상률'] || 0);
                                if (isRowRefund && rateFloat > 0) rateFloat = -rateFloat;

                                const curContent = editedItems[key]['시상내용'] !== undefined ? editedItems[key]['시상내용'] : (row['시상내용'] || '');
                                const curLeaderName = editedItems[key]['지급대상자1명'] !== undefined ? editedItems[key]['지급대상자1명'] : (row['지급대상자1명'] || '');
                                const curLeaderId = editedItems[key]['지급대상자1사번'] !== undefined ? editedItems[key]['지급대상자1사번'] : (row['지급대상자1사번'] || '');
                                const curFpName = editedItems[key]['지급대상자2명'] !== undefined ? editedItems[key]['지급대상자2명'] : (row['지급대상자2명'] || '');
                                const curFpId = editedItems[key]['지급대상자2사번'] !== undefined ? editedItems[key]['지급대상자2사번'] : (row['지급대상자2사번'] || '');

                                let curPay1 = editedItems[key]['지급액1'] !== undefined ? editedItems[key]['지급액1'] : (row['지급액1'] !== '' ? Number(row['지급액1']) : '');
                                let curPay2 = editedItems[key]['지급액2'] !== undefined ? editedItems[key]['지급액2'] : Number(row['지급액2'] || 0);
                                if (isRowRefund && curPay2 > 0) curPay2 = -curPay2;

                                let curRatio1 = editedItems[key]['지급비율1'] !== undefined ? editedItems[key]['지급비율1'] : (row['지급비율1'] !== '' ? Number(row['지급비율1']) : '');
                                let curRatio2 = editedItems[key]['지급비율2'] !== undefined ? editedItems[key]['지급비율2'] : Number(row['지급비율2'] || 0);
                                if (isRowRefund && curRatio2 > 0) curRatio2 = -curRatio2;

                                // 1. 지급대상자1 적용 (값이 있으면 변경, 없으면 기존 값 유지)
                                let finalLeaderName = curLeaderName;
                                let finalLeaderId = curLeaderId;
                                if (hasLeader) {
                                    const foundUser = (allUserList && allUserList.find(u => String(u.name).trim() === defaultLeaderVal || String(u.id).trim() === defaultLeaderVal))
                                        || (userList && userList.find(u => String(u.name).trim() === defaultLeaderVal || String(u.id).trim() === defaultLeaderVal));
                                    if (foundUser) {
                                        finalLeaderName = foundUser.name;
                                        finalLeaderId = foundUser.id;
                                    } else {
                                        finalLeaderName = defaultLeaderVal;
                                        finalLeaderId = '';
                                    }
                                }

                                // 2. 지급대상자2 적용 (값이 있으면 변경, 없으면 기존 값 유지)
                                let finalFpName = curFpName;
                                let finalFpId = curFpId;
                                if (hasFp) {
                                    const foundUser = (allUserList && allUserList.find(u => String(u.name).trim() === defaultFpVal || String(u.id).trim() === defaultFpVal))
                                        || (userList && userList.find(u => String(u.name).trim() === defaultFpVal || String(u.id).trim() === defaultFpVal));
                                    if (foundUser) {
                                        finalFpName = foundUser.name;
                                        finalFpId = foundUser.id;
                                    } else {
                                        finalFpName = defaultFpVal;
                                        finalFpId = '';
                                    }
                                }

                                // 3. 시상률(지급비율2) 적용 (값이 있으면 재계산, 없으면 기존 값 유지)
                                let finalRatio2 = curRatio2;
                                let finalPay2 = curPay2;
                                let finalRatio1 = curRatio1;
                                let finalPay1 = curPay1;

                                if (hasRatio) {
                                    finalRatio2 = isRowRefund ? -Math.abs(targetRatio2) : targetRatio2;
                                    finalPay2 = premium !== 0 ? Math.floor(premium * finalRatio2) : 0;
                                    if (isRowRefund && finalPay2 > 0) {
                                        finalPay2 = -finalPay2;
                                    }

                                    if (isAdjustment) {
                                        finalRatio1 = rateFloat - finalRatio2;
                                        finalPay1 = totalReward - finalPay2;
                                    }
                                }

                                editedItems[key] = {
                                    '마감월': row['마감월'],
                                    '보험사': row['보험사'],
                                    '증권번호': row['증권번호'],
                                    '사번': row['사번'],
                                    '납입회차': row['납입회차'] || '',
                                    '시상률': rateFloat,
                                    '시상내용': curContent,
                                    '지급대상자1명': finalLeaderName,
                                    '지급대상자1사번': finalLeaderId,
                                    '지급액1': finalPay1,
                                    '지급비율1': finalRatio1,
                                    '지급대상자2명': finalFpName,
                                    '지급대상자2사번': finalFpId,
                                    '지급액2': finalPay2,
                                    '지급비율2': finalRatio2
                                };
                                appliedCount++;
                            }
                        }
                    });

                    if (appliedCount > 0) {
                        renderTable();
                        unsavedBadge.classList.remove('hidden');
                        saveAdjustBtn.disabled = false;
                        alert(`${appliedCount}건의 데이터에 시상조정 디폴트값이 자동 적용되었습니다.\n내용 확인 후 상단의 [변경사항 저장] 버튼을 눌러 저장해 주세요.`);
                    } else {
                        alert('현재 조회된 데이터와 일치하는 디폴트 설정 규칙을 찾지 못했습니다.');
                    }

                } catch (e) {
                    showLoading(false);
                    console.error(e);
                    alert('디폴트값 적용 중 오류가 발생했습니다: ' + e.message);
                }
            });

            // 조정내용 파일로 내보내기 버튼 이벤트
            exportAdjustBtn.addEventListener('click', async () => {
                const targetMonth = adjMonth.value;
                if (!targetMonth) {
                    alert('조회할 마감월이 선택되지 않았습니다.');
                    return;
                }

                if (!confirm(`${targetMonth} 마감월의 조정내용을 엑셀 파일로 내보내시겠습니까?\n(생보법인, 손보법인, 2차년인센 데이터가 각각 다른 시트에 저장됩니다.)`)) {
                    return;
                }

                showLoading(true);
                try {
                    const res = await callApi('getRewardAdjustExportData', state.user.staffId, targetMonth);
                    showLoading(false);

                    if (res.error || !res.success) {
                        alert('데이터를 가져오지 못했습니다: ' + (res.message || '네트워크 오류'));
                        return;
                    }

                    const exportData = res.data || {};
                    const sheetsList = ['생보법인', '손보법인', '2차년인센'];
                    
                    // 데이터가 하나라도 있는지 체크
                    let hasData = false;
                    sheetsList.forEach(s => {
                        if (exportData[s] && exportData[s].length > 0) hasData = true;
                    });

                    if (!hasData) {
                        alert(`${targetMonth} 마감월에 해당하는 시상 조정 데이터가 존재하지 않습니다.`);
                        return;
                    }

                    // ExcelJS를 사용하여 워크북 생성
                    const workbook = new ExcelJS.Workbook();

                    sheetsList.forEach(sheetName => {
                        const list = exportData[sheetName] || [];
                        const worksheet = workbook.addWorksheet(sheetName);

                        // 첫 행 고정
                        worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

                        // 헤더
                        const headers = ['현금구분', '분류(지사조정/적립)', '사번', '이름', '지급기준액', '증권번호', '적요', '보험사'];
                        const headerRow = worksheet.addRow(headers);

                        // 헤더 스타일링 (연한초록색 배경: #E2EFDA, 맑은 고딕, 굵게, 테두리)
                        headerRow.eachCell((cell) => {
                            cell.fill = {
                                type: 'pattern',
                                pattern: 'solid',
                                fgColor: { argb: 'FFE2EFDA' }
                            };
                            cell.font = {
                                name: '맑은 고딕',
                                size: 10,
                                bold: true,
                                color: { argb: 'FF333333' }
                            };
                            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
                            cell.border = {
                                top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                                left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                                bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                                right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
                            };
                        });

                        // 데이터 채우기
                        list.forEach(row => {
                            const dataRow = worksheet.addRow([
                                row['현금구분'] || '',
                                row['분류(지사조정/적립)'] || '',
                                row['사번'] || '',
                                row['이름'] || '',
                                Number(row['지급기준액'] || 0),
                                row['증권번호'] || '',
                                row['적요'] || '',
                                row['보험사'] || ''
                            ]);

                            // 셀 정렬 및 포맷팅
                            dataRow.eachCell((cell, colNumber) => {
                                cell.font = { name: '맑은 고딕', size: 10 };
                                cell.border = {
                                    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                                    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                                };

                                // 정렬 및 넘버 포맷
                                if ([1, 2, 3, 4, 8].includes(colNumber)) {
                                    // 현금구분, 분류, 사번, 이름, 보험사
                                    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
                                } else if (colNumber === 5) {
                                    // 지급기준액
                                    cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: false };
                                    cell.numFmt = '#,##0';
                                } else {
                                    // 증권번호, 적요
                                    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: false };
                                }

                                if (colNumber === 3 || colNumber === 6) {
                                    cell.numFmt = '@'; // 사번, 증권번호 텍스트 지정
                                }
                            });
                        });

                        // 열 너비 자동 조정
                        worksheet.columns.forEach((column) => {
                            let maxLen = 10;
                            column.eachCell({ includeEmpty: false }, (cell) => {
                                const valStr = String(cell.value || '');
                                let len = 0;
                                for (let i = 0; i < valStr.length; i++) {
                                    len += valStr.charCodeAt(i) > 128 ? 2 : 1;
                                }
                                if (len > maxLen) maxLen = len;
                            });
                            column.width = maxLen + 2;
                        });
                    });

                    // 4번째 시트: '요약' 시트 생성 (앞의 3개 시트 내용 취합)
                    const summaryMap = {};
                    sheetsList.forEach(sheetName => {
                        const list = exportData[sheetName] || [];
                        list.forEach(row => {
                            const id = String(row['사번'] || '').trim();
                            const name = String(row['이름'] || '').trim();
                            if (!id) return;

                            if (!summaryMap[id]) {
                                summaryMap[id] = {
                                    id: id,
                                    name: name,
                                    '생보법인_pay': 0,
                                    '생보법인_refund': 0,
                                    '손보법인_pay': 0,
                                    '손보법인_refund': 0,
                                    '2차년인센_pay': 0,
                                    '2차년인센_refund': 0
                                };
                            }
                            if (!summaryMap[id].name && name) {
                                summaryMap[id].name = name;
                            }

                            const amt = Number(row['지급기준액'] || 0);
                            if (amt > 0) {
                                summaryMap[id][`${sheetName}_pay`] += amt;
                            } else if (amt < 0) {
                                summaryMap[id][`${sheetName}_refund`] += amt;
                            }
                        });
                    });

                    // 정렬: 1순위 박용수(2024030027), 2순위 성정우(2025020084), 나머지 사번 오름차순
                    const summaryList = Object.values(summaryMap);
                    summaryList.sort((a, b) => {
                        if (a.id === '2024030027') return -1;
                        if (b.id === '2024030027') return 1;
                        if (a.id === '2025020084') return -1;
                        if (b.id === '2025020084') return 1;
                        return a.id.localeCompare(b.id);
                    });

                    const summarySheet = workbook.addWorksheet('요약');
                    summarySheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 2 }];

                    // 1행 및 2행 헤더 추가
                    summarySheet.addRow(['사번', '이름', '생보법인', '', '손보법인', '', '2차년인센', '']);
                    summarySheet.addRow(['', '', '지급', '환수', '지급', '환수', '지급', '환수']);

                    // 셀 병합
                    summarySheet.mergeCells('A1:A2');
                    summarySheet.mergeCells('B1:B2');
                    summarySheet.mergeCells('C1:D1');
                    summarySheet.mergeCells('E1:F1');
                    summarySheet.mergeCells('G1:H1');

                    // 헤더 스타일링 (연한 하늘색 배경: #DDEBF7, 맑은 고딕, 굵게, 테두리)
                    const headerStyle = {
                        fill: {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFDDEBF7' }
                        },
                        font: {
                            name: '맑은 고딕',
                            size: 10,
                            bold: true,
                            color: { argb: 'FF000000' }
                        },
                        alignment: { vertical: 'middle', horizontal: 'center', wrapText: false },
                        border: {
                            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
                        }
                    };

                    for (let r = 1; r <= 2; r++) {
                        const rowObj = summarySheet.getRow(r);
                        for (let c = 1; c <= 8; c++) {
                            const cell = rowObj.getCell(c);
                            cell.fill = headerStyle.fill;
                            cell.font = headerStyle.font;
                            cell.alignment = headerStyle.alignment;
                            cell.border = headerStyle.border;
                        }
                    }

                    // 요약 데이터 채우기
                    summaryList.forEach(item => {
                        const p1 = item['생보법인_pay'];
                        const r1 = item['생보법인_refund'];
                        const p2 = item['손보법인_pay'];
                        const r2 = item['손보법인_refund'];
                        const p3 = item['2차년인센_pay'];
                        const r3 = item['2차년인센_refund'];

                        const dataRow = summarySheet.addRow([
                            item.id,
                            item.name,
                            p1 !== 0 ? p1 : '',
                            r1 !== 0 ? r1 : '',
                            p2 !== 0 ? p2 : '',
                            r2 !== 0 ? r2 : '',
                            p3 !== 0 ? p3 : '',
                            r3 !== 0 ? r3 : ''
                        ]);

                        dataRow.eachCell((cell, colNumber) => {
                            cell.font = { name: '맑은 고딕', size: 10 };
                            cell.border = {
                                top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                                left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                                bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                                right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                            };

                            if (colNumber === 1 || colNumber === 2) {
                                cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
                                if (colNumber === 1) cell.numFmt = '@';
                            } else {
                                cell.alignment = { vertical: 'middle', horizontal: 'right', wrapText: false };
                                cell.numFmt = '#,##0';
                            }
                        });
                    });

                    // 요약 시트 열 너비 자동 조정
                    summarySheet.columns.forEach((column) => {
                        let maxLen = 10;
                        column.eachCell({ includeEmpty: false }, (cell) => {
                            const valStr = String(cell.value || '');
                            let len = 0;
                            for (let i = 0; i < valStr.length; i++) {
                                len += valStr.charCodeAt(i) > 128 ? 2 : 1;
                            }
                            if (len > maxLen) maxLen = len;
                        });
                        column.width = maxLen + 3;
                    });

                    // 저장년월일 계산 (YYYYMMDD)
                    const now = new Date();
                    const year = now.getFullYear();
                    const month = String(now.getMonth() + 1).padStart(2, '0');
                    const date = String(now.getDate()).padStart(2, '0');
                    const dateStr = `${year}${month}${date}`;

                    const fileName = `지사용 시상조정 파일_${dateStr}.xlsx`;

                    const data = await workbook.xlsx.writeBuffer();
                    const blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                    const url = window.URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = fileName;
                    anchor.click();
                    window.URL.revokeObjectURL(url);

                } catch (e) {
                    showLoading(false);
                    console.error(e);
                    alert('엑셀 파일 생성 중 오류가 발생했습니다: ' + e.message);
                }
            });

                let contractDateSortState = 'none'; // 'none' | 'asc' | 'desc'

                // 2. 조회 실행 함수
                async function fetchAdjustData() {
                    showLoading(true);
                    selectedRows.clear();
                    selectAllCheckbox.checked = false;
                    editedItems = {};
                    unsavedBadge.classList.add('hidden');
                    saveAdjustBtn.disabled = true;
                    batchEditBtn.disabled = true;
                    batchEditAllBtn.disabled = true;
                    contractDateSortState = 'none';
                    if (contractDateSortIcon) {
                        contractDateSortIcon.textContent = '⇅';
                        contractDateSortIcon.className = 'text-gray-400 font-bold ml-0.5';
                    }

                    const filter = {
                        rewardType: adjRewardType.value,
                        month: adjMonth.value,
                        company: adjCompany.value,
                        branch: adjBranch.value,
                        agent: adjAgent.value.trim() || '전체',
                        payRefund: adjPayRefund.value
                    };

                    const res = await callApi('getRewardAdjustData', state.user.staffId, filter);
                    showLoading(false);

                    if (res.error) {
                        alert('조회 실패: ' + res.message);
                        return;
                    }

                    listData = res.list || [];
                    userList = res.users || [];
                    allUserList = res.allUsers || []; // 전체 사용자 목록 수급
                    defaultsList = res.defaults || [];

                    originalMap = {};
                    listData.forEach((item, idx) => {
                        item._origIdx = idx; // 원본 순서 보존용 인덱스
                        const key = getRowKey(item);
                        originalMap[key] = { ...item };
                    });

                    // 필터 바 드롭다운 동적 재구축 및 이전 선택값 자동 복원
                    const prevComp = adjCompany.value;
                    const prevBranch = adjBranch.value;

                    adjCompany.innerHTML = '<option value="전체">전체</option>';
                    adjBranch.innerHTML = '<option value="전체">전체</option>';

                    const companies = [...new Set(listData.map(x => String(x['보험사'] || '').trim()).filter(Boolean))].sort();
                    companies.forEach(c => {
                        const opt = document.createElement('option');
                        opt.value = c; opt.textContent = c;
                        adjCompany.appendChild(opt);
                    });

                    const branches = [...new Set(listData.map(x => String(x['소속2'] || '').trim()).filter(Boolean))].sort();
                    branches.forEach(b => {
                        const opt = document.createElement('option');
                        opt.value = b; opt.textContent = b;
                        adjBranch.appendChild(opt);
                    });

                    if (companies.includes(prevComp)) adjCompany.value = prevComp;
                    if (branches.includes(prevBranch)) adjBranch.value = prevBranch;

                    if (listData.length > 0) {
                        batchEditAllBtn.disabled = false;
                    }

                    renderTable();
                }

                // 계약일 헤더 클릭 시 3단 정렬 토글 (오름차순 -> 내림차순 -> 정렬취소)
                if (thContractDate) {
                    thContractDate.addEventListener('click', () => {
                        if (!listData || listData.length === 0) return;

                        if (contractDateSortState === 'none') {
                            contractDateSortState = 'asc';
                            contractDateSortIcon.textContent = '▲';
                            contractDateSortIcon.className = 'text-primary font-black ml-0.5';
                            listData.sort((a, b) => {
                                const dA = String(a['계약일'] || '').trim();
                                const dB = String(b['계약일'] || '').trim();
                                if (!dA && !dB) return 0;
                                if (!dA) return 1;
                                if (!dB) return -1;
                                return dA.localeCompare(dB);
                            });
                        } else if (contractDateSortState === 'asc') {
                            contractDateSortState = 'desc';
                            contractDateSortIcon.textContent = '▼';
                            contractDateSortIcon.className = 'text-primary font-black ml-0.5';
                            listData.sort((a, b) => {
                                const dA = String(a['계약일'] || '').trim();
                                const dB = String(b['계약일'] || '').trim();
                                if (!dA && !dB) return 0;
                                if (!dA) return 1;
                                if (!dB) return -1;
                                return dB.localeCompare(dA);
                            });
                        } else {
                            contractDateSortState = 'none';
                            contractDateSortIcon.textContent = '⇅';
                            contractDateSortIcon.className = 'text-gray-400 font-bold ml-0.5';
                            listData.sort((a, b) => (a._origIdx || 0) - (b._origIdx || 0));
                        }

                        renderTable();
                    });
                }

                function getRowKey(row) {
                    const m = String(row['마감월'] || '').trim();
                    const c = String(row['보험사'] || '').trim();
                    const p = String(row['증권번호'] || '').trim();
                    const a = String(row['사번'] || '').trim();
                    const r = String(row['납입회차'] || '').trim();
                    return `${m}_${c}_${p}_${a}_${r}`;
                }

                // 합계 행 계산 및 출력 함수
                function updateSummaryRows() {
                    if (!sumPrevReward) return;
                    const isAdjustment = ['2차년인센', '생보법인', '손보법인'].includes(adjRewardType.value);

                    if (!listData || listData.length === 0) {
                        sumPrevReward.innerHTML = '-';
                        sumPrevPay1.innerHTML = '-';
                        sumPrevPay2.innerHTML = '-';
                        sumCurrReward.innerHTML = '-';
                        sumCurrPay1.innerHTML = '-';
                        sumCurrPay2.innerHTML = '-';
                        return;
                    }

                    let prevReward = 0;
                    let prevPay1 = 0;
                    let prevPay2 = 0;

                    let currReward = 0;
                    let currPay1 = 0;
                    let currPay2 = 0;

                    listData.forEach(row => {
                        const key = getRowKey(row);
                        const isEdited = !!editedItems[key];

                        // 변경전 합계 (원본 데이터 기준)
                        if (isAdjustment) {
                            prevReward += Number(row['시상금'] || 0);
                            prevPay1 += row['지급액1'] !== '' ? Number(row['지급액1'] || 0) : 0;
                        }
                        prevPay2 += Number(row['지급액2'] || 0);

                        // 변경후 합계 (수정본 반영)
                        if (isAdjustment) {
                            currReward += Number(row['시상금'] || 0);
                            const p1 = (isEdited && editedItems[key]['지급액1'] !== undefined)
                                ? (editedItems[key]['지급액1'] !== '' ? Number(editedItems[key]['지급액1']) : 0)
                                : (row['지급액1'] !== '' ? Number(row['지급액1']) : 0);
                            currPay1 += p1;
                        }
                        const p2 = (isEdited && editedItems[key]['지급액2'] !== undefined)
                            ? Number(editedItems[key]['지급액2'] || 0)
                            : Number(row['지급액2'] || 0);
                        currPay2 += p2;
                    });

                    sumPrevReward.innerHTML = isAdjustment ? formatMoneyAdj(prevReward, 'text-slate-800') : '-';
                    sumPrevPay1.innerHTML = isAdjustment ? formatMoneyAdj(prevPay1, 'text-slate-800') : '-';
                    sumPrevPay2.innerHTML = formatMoneyAdj(prevPay2, 'text-slate-800');

                    sumCurrReward.innerHTML = isAdjustment ? formatMoneyAdj(currReward, 'text-amber-950') : '-';
                    sumCurrPay1.innerHTML = isAdjustment ? formatMoneyAdj(currPay1, 'text-blue-900') : '-';
                    sumCurrPay2.innerHTML = formatMoneyAdj(currPay2, 'text-indigo-900');
                }

                // 3. 테이블 드로우 함수
                function renderTable() {
                    adjTableBody.innerHTML = '';
                    adjResultCount.textContent = listData.length;
                    updateSummaryRows();

                    if (listData.length === 0) {
                        adjTableBody.innerHTML = `
                            <tr>
                                <td colspan="20" class="p-8 text-center text-gray-400 font-medium">검색된 데이터가 없습니다.</td>
                            </tr>
                        `;
                        return;
                    }

                const isAdjustment = ['2차년인센', '생보법인', '손보법인'].includes(adjRewardType.value);

                listData.forEach((row) => {
                    const key = getRowKey(row);
                    const isEdited = !!editedItems[key];
                    const tr = document.createElement('tr');
                    tr.className = `hover:bg-slate-50/50 transition-colors ${isEdited ? 'bg-blue-50/40' : ''}`;
                    tr.dataset.key = key;

                    const cleanPayRefund = String(row['지급/환수'] || row['구분'] || row['지급구분'] || '지급').replace(/\s+/g, '');
                    const isPay = cleanPayRefund.includes('지급');
                    const isRefund = cleanPayRefund.includes('환수');
                    const badgeClass = isPay ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100';

                    // 상태 값 매핑 (수정본 or 원본)
                    const curContent = isEdited && editedItems[key]['시상내용'] !== undefined ? editedItems[key]['시상내용'] : (row['시상내용'] || '');
                    
                    const curLeaderName = isEdited && editedItems[key]['지급대상자1명'] !== undefined ? editedItems[key]['지급대상자1명'] : (row['지급대상자1명'] || '');
                    const curLeaderId = isEdited && editedItems[key]['지급대상자1사번'] !== undefined ? editedItems[key]['지급대상자1사번'] : (row['지급대상자1사번'] || '');
                    
                    const curFpName = isEdited && editedItems[key]['지급대상자2명'] !== undefined ? editedItems[key]['지급대상자2명'] : (row['지급대상자2명'] || '');
                    const curFpId = isEdited && editedItems[key]['지급대상자2사번'] !== undefined ? editedItems[key]['지급대상자2사번'] : (row['지급대상자2사번'] || '');

                    const curPay1 = isEdited && editedItems[key]['지급액1'] !== undefined ? editedItems[key]['지급액1'] : (row['지급액1'] !== '' ? Number(row['지급액1']) : '');
                    let curPay2 = isEdited && editedItems[key]['지급액2'] !== undefined ? editedItems[key]['지급액2'] : Number(row['지급액2'] || 0);
                    if (isRefund && curPay2 > 0) curPay2 = -curPay2;

                    const curRatio1 = isEdited && editedItems[key]['지급비율1'] !== undefined ? editedItems[key]['지급비율1'] : (row['지급비율1'] !== '' ? Number(row['지급비율1']) : '');
                    let curRatio2 = isEdited && editedItems[key]['지급비율2'] !== undefined ? editedItems[key]['지급비율2'] : Number(row['지급비율2'] || 0);
                    if (isRefund && curRatio2 > 0) curRatio2 = -curRatio2;

                    // 시상률 백분율 포맷
                    let rateFloat = Number(row['시상률'] || 0);
                    if (isRefund && rateFloat > 0) rateFloat = -rateFloat;

                    // 지급대상자1
                    const selectLeaderHtml = isAdjustment ? `
                        <select class="leader-select bg-transparent border border-gray-200 rounded px-1 py-0.5 w-20 focus:bg-white focus:border-primary outline-none cursor-pointer text-xs font-semibold">
                            <option value="">(없음)</option>
                            ${userList.map(u => `<option value="${u.id}" ${String(u.id) === String(curLeaderId) ? 'selected' : ''}>${u.name}</option>`).join('')}
                        </select>
                    ` : `<span class="text-gray-400 font-medium">해당없음</span>`;

                    // 지급대상자2
                    const selectFpHtml = `
                        <select class="fp-select bg-transparent border border-gray-200 rounded px-1 py-0.5 w-20 focus:bg-white focus:border-primary outline-none cursor-pointer text-xs font-semibold">
                            <option value="">(없음)</option>
                            ${allUserList.map(u => `<option value="${u.id}" ${String(u.id) === String(curFpId) ? 'selected' : ''}>${u.name}</option>`).join('')}
                        </select>
                    `;

                    // 금액 및 비율 포맷팅
                    const rewardAmtText = isAdjustment ? formatMoneyAdj(row['시상금'], 'text-gray-800') : '-';
                    const pay1Text = (isAdjustment && curPay1 !== '') ? formatMoneyAdj(curPay1, 'text-slate-700') : '-';
                    const ratio1Text = (isAdjustment && curRatio1 !== '') ? formatRateAdj(curRatio1, 'text-gray-600') : '-';

                    tr.innerHTML = `
                        <td class="p-3 text-center"><input type="checkbox" class="row-checkbox" ${selectedRows.has(key) ? 'checked' : ''}></td>
                        <td class="p-3 font-semibold text-gray-500">${row['마감월'] || ''}</td>
                        <td style="width: 100px; min-width: 100px; white-space: nowrap;" class="p-3 font-bold">${row['보험사'] || ''}</td>
                        <td style="width: 75px; min-width: 75px; white-space: nowrap;" class="p-3 text-gray-500">${row['소속2'] || ''}</td>
                        <td style="width: 60px; min-width: 60px; white-space: nowrap;" class="p-3 text-center">
                            <span class="px-2 py-0.5 rounded text-[10px] font-extrabold whitespace-nowrap inline-block ${badgeClass}">${cleanPayRefund}</span>
                        </td>
                        <td class="p-3 text-gray-600 font-mono">${row['증권번호'] || ''}</td>
                        <td style="width: 60px; min-width: 60px; white-space: nowrap;" class="p-3 font-bold">${maskContractor(row['계약자'])}</td>
                        <td style="width: 85px; min-width: 85px; white-space: nowrap;" class="p-3 text-gray-400 font-mono">${row['계약일'] || ''}</td>
                        <td class="p-3 text-center">${row['납입회차'] || ''}</td>
                        <td class="p-3 text-right font-bold">${formatMoneyAdj(row['보험료'], 'text-slate-500')}</td>
                        <td class="p-3 text-gray-600 max-w-[120px] truncate" title="${row['상품명'] || ''}">${row['상품명'] || ''}</td>
                        
                        <!-- 5개 수정 가능 열 및 연동 셀 -->
                        <td class="p-2"><input type="text" class="content-input w-28 border border-gray-200 rounded px-1.5 py-0.5" value="${curContent}"></td>
                        <td class="p-3 text-right font-bold">${rewardAmtText}</td>
                        <td class="p-3 text-center font-bold">${formatRateAdj(rateFloat, 'text-indigo-600')}</td>
                        
                        <td class="p-2">${selectLeaderHtml}</td>
                        <td class="p-3 text-right font-bold pay1-cell">${pay1Text}</td>
                        <td class="p-3 text-center font-bold ratio1-cell">${ratio1Text}</td>
                        
                        <td class="p-2">${selectFpHtml}</td>
                        <td class="p-2 text-right">
                            <input type="text" class="pay2-input w-20 border border-gray-200 rounded px-1.5 py-0.5 text-right font-bold ${curPay2 < 0 ? 'text-rose-600' : 'text-gray-800'}" value="${formatNumberWithCommas(curPay2)}">
                        </td>
                        <td class="p-2 text-center">
                            <div class="flex items-center gap-0.5 justify-center">
                                <input type="number" step="any" class="ratio2-input w-14 border border-gray-200 rounded px-1 py-0.5 text-center font-bold ${curRatio2 < 0 ? 'text-rose-600' : 'text-gray-800'}" value="${Number((curRatio2 * 100).toFixed(2))}">%
                            </div>
                        </td>
                    `;

                    // 각 요소 맵 구성
                    const contentEl = tr.querySelector('.content-input');
                    const selectLeaderEl = tr.querySelector('.leader-select');
                    const selectFpEl = tr.querySelector('.fp-select');
                    const pay1Cell = tr.querySelector('.pay1-cell');
                    const ratio1Cell = tr.querySelector('.ratio1-cell');
                    const pay2El = tr.querySelector('.pay2-input');
                    const ratio2El = tr.querySelector('.ratio2-input');

                    const premium = Number(row['보험료'] || 0);
                    const totalReward = isAdjustment ? Number(row['시상금'] || 0) : 0;

                    const handleEditing = (source) => {
                        if (!editedItems[key]) editedItems[key] = {};

                        const valContent = contentEl.value.trim();
                        const valLeaderId = selectLeaderEl ? selectLeaderEl.value : '';
                        const valLeaderName = valLeaderId ? selectLeaderEl.options[selectLeaderEl.selectedIndex].text : '';
                        const valFpId = selectFpEl.value;
                        const valFpName = valFpId ? selectFpEl.options[selectFpEl.selectedIndex].text : '';
                        
                        const rawPay2Val = pay2El.value.replace(/,/g, '');
                        let valPay2 = parseInt(rawPay2Val) || 0;
                        if (isRefund && valPay2 > 0) valPay2 = -valPay2;

                        let valRatio2 = (parseFloat(ratio2El.value) || 0) / 100;
                        if (isRefund && valRatio2 > 0) valRatio2 = -valRatio2;

                        let finalRatio2 = valRatio2;
                        let finalPay2 = valPay2;
                        let finalRatio1 = 0;
                        let finalPay1 = 0;

                        if (isAdjustment) {
                            if (source === 'pay2') {
                                // [공식: 지급액2 입력 시] 시상금 = 지급액1 + 지급액2
                                finalPay2 = valPay2;
                                finalPay1 = totalReward - finalPay2;

                                if (premium !== 0) {
                                    finalRatio2 = finalPay2 / premium;
                                    finalRatio1 = finalPay1 / premium;
                                    let r2Percent = Number((finalRatio2 * 100).toFixed(2));
                                    if (isRefund && r2Percent > 0) r2Percent = -r2Percent;
                                    ratio2El.value = r2Percent;
                                } else {
                                    finalRatio1 = rateFloat - finalRatio2;
                                }

                                ratio1Cell.innerHTML = formatRateAdj(finalRatio1, 'text-gray-600');
                                pay1Cell.innerHTML = formatMoneyAdj(finalPay1, 'text-slate-700');
                            } else {
                                // [공식: 지급비율2 입력 시 (기본)] 지급액2 자동계산(소수점 버림) 후 지급액1 = 시상금 - 지급액2
                                finalRatio2 = valRatio2;
                                finalRatio1 = rateFloat - finalRatio2;

                                finalPay2 = premium !== 0 ? Math.floor(premium * finalRatio2) : 0;
                                if (isRefund && finalPay2 > 0) finalPay2 = -finalPay2;
                                finalPay1 = totalReward - finalPay2;

                                pay2El.value = formatNumberWithCommas(finalPay2);
                                ratio1Cell.innerHTML = formatRateAdj(finalRatio1, 'text-gray-600');
                                pay1Cell.innerHTML = formatMoneyAdj(finalPay1, 'text-slate-700');
                            }
                        } else {
                            if (source === 'pay2') {
                                finalPay2 = valPay2;
                                if (premium !== 0) {
                                    finalRatio2 = finalPay2 / premium;
                                    let r2Percent = Number((finalRatio2 * 100).toFixed(2));
                                    if (isRefund && r2Percent > 0) r2Percent = -r2Percent;
                                    ratio2El.value = r2Percent;
                                }
                            } else {
                                finalRatio2 = valRatio2;
                                finalPay2 = premium !== 0 ? Math.floor(premium * finalRatio2) : 0;
                                if (isRefund && finalPay2 > 0) finalPay2 = -finalPay2;
                                pay2El.value = formatNumberWithCommas(finalPay2);
                            }
                        }

                        updateInputNegativeColor(pay2El, finalPay2);
                        updateInputNegativeColor(ratio2El, ratio2El.value);

                        editedItems[key] = {
                            '마감월': row['마감월'],
                            '보험사': row['보험사'],
                            '증권번호': row['증권번호'],
                            '사번': row['사번'],
                            '납입회차': row['납입회차'] || '',
                            '시상률': rateFloat,
                            '시상내용': valContent,
                            '지급대상자1명': valLeaderName,
                            '지급대상자1사번': valLeaderId,
                            '지급액1': finalPay1,
                            '지급비율1': finalRatio1,
                            '지급대상자2명': valFpName,
                            '지급대상자2사번': valFpId,
                            '지급액2': finalPay2,
                            '지급비율2': finalRatio2
                        };

                        tr.classList.add('bg-blue-50/40');
                        unsavedBadge.classList.remove('hidden');
                        saveAdjustBtn.disabled = false;
                        updateSummaryRows();
                    };

                    contentEl.addEventListener('input', () => handleEditing('content'));
                    if (selectLeaderEl) selectLeaderEl.addEventListener('change', () => handleEditing('leader'));
                    selectFpEl.addEventListener('change', () => handleEditing('fp'));

                    // 지급비율2 변경 시 연동 (공식: 시상률 = 지급비율1 + 지급비율2, 소수점 버림)
                    ratio2El.addEventListener('input', () => {
                        let val = ratio2El.value;
                        if (val === '-' || val === '') return;
                        let num = parseFloat(val);
                        if (!isNaN(num) && isRefund && num > 0) {
                            num = -num;
                            ratio2El.value = num;
                        }
                        updateInputNegativeColor(ratio2El, ratio2El.value);
                        handleEditing('ratio2');
                    });
                    ratio2El.addEventListener('blur', () => {
                        let val = ratio2El.value.trim();
                        if (val === '' || val === '-') {
                            ratio2El.value = '0';
                            updateInputNegativeColor(ratio2El, 0);
                            handleEditing('ratio2');
                        }
                    });

                    // 지급액2 변경 시 연동 (공식: 시상금 = 지급액1 + 지급액2, 마이너스 값 허용)
                    pay2El.addEventListener('input', (e) => {
                        let val = e.target.value;
                        if (val === '-' || val === '') return;
                        let raw = val.replace(/,/g, '');
                        let p2 = parseInt(raw);
                        if (isNaN(p2)) p2 = 0;
                        if (isRefund && p2 > 0) {
                            p2 = -p2;
                        }
                        e.target.value = formatNumberWithCommas(p2);
                        updateInputNegativeColor(pay2El, p2);
                        handleEditing('pay2');
                    });
                    pay2El.addEventListener('blur', () => {
                        let val = pay2El.value.trim();
                        if (val === '' || val === '-') {
                            let p2 = 0;
                            pay2El.value = formatNumberWithCommas(p2);
                            updateInputNegativeColor(pay2El, p2);
                            handleEditing('pay2');
                        }
                    });

                    const checkbox = tr.querySelector('.row-checkbox');
                    checkbox.addEventListener('change', (e) => {
                        if (e.target.checked) selectedRows.add(key);
                        else selectedRows.delete(key);
                        updateBatchEditButtonState();
                    });

                    adjTableBody.appendChild(tr);
                });
            }

            function updateBatchEditButtonState() {
                batchEditBtn.disabled = selectedRows.size === 0;
                selectAllCheckbox.checked = selectedRows.size === listData.length && listData.length > 0;
            }

            selectAllCheckbox.addEventListener('change', (e) => {
                const isChecked = e.target.checked;
                container.querySelectorAll('.row-checkbox').forEach(cb => {
                    cb.checked = isChecked;
                    const key = cb.closest('tr').dataset.key;
                    if (isChecked) selectedRows.add(key);
                    else selectedRows.delete(key);
                });
                updateBatchEditButtonState();
            });

            batchEditBtn.addEventListener('click', () => {
                if (selectedRows.size === 0) return;
                showBatchEditModal('selected');
            });

            batchEditAllBtn.addEventListener('click', () => {
                if (listData.length === 0) return;
                showBatchEditModal('all');
            });

            // 6. 일괄수정 모달 구현
            function showBatchEditModal(mode) {
                const modalId = 'batch-edit-1step-modal';
                let modal = document.getElementById(modalId);
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = modalId;
                    modal.className = "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn";
                    document.body.appendChild(modal);
                }

                const targetCount = mode === 'selected' ? selectedRows.size : listData.length;
                const isAdjustment = ['2차년인센', '생보법인', '손보법인'].includes(adjRewardType.value);
                const userOptions = userList.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
                const allUserOptions = allUserList.map(u => `<option value="${u.id}">${u.name}</option>`).join('');

                modal.innerHTML = `
                    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform scale-100 flex flex-col max-h-[92vh]">
                        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
                            <h3 class="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <span class="w-1.5 h-5 bg-primary rounded-full block"></span>
                                일괄 조정 (${mode === 'selected' ? '선택' : '전체'} ${targetCount}건)
                            </h3>
                            <button id="closeBatchModalBtn" class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div class="p-5 sm:p-6 space-y-3.5 text-left text-sm max-h-[calc(92vh-130px)] overflow-y-auto">
                            <p class="text-xs text-slate-400 font-bold mb-1">* 우측의 '수정적용' 체크를 활성화한 항목만 일괄 변경됩니다.</p>
                            
                            <!-- 1. 시상내용 -->
                            <div class="flex items-center justify-between gap-4 border-b border-slate-50 pb-2">
                                <div class="flex-1">
                                    <label class="block text-xs font-bold text-gray-500 mb-1">시상내용</label>
                                    <input type="text" id="modalContent" disabled class="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary" placeholder="내용 입력">
                                </div>
                                <div class="flex items-center gap-1.5 pt-4">
                                    <input type="checkbox" id="chkContent" class="w-4 h-4 cursor-pointer">
                                    <label for="chkContent" class="text-xs font-bold text-slate-600 cursor-pointer select-none">수정적용</label>
                                </div>
                            </div>

                            <!-- 2. 지급대상자1 -->
                            <div class="flex items-center justify-between gap-4 border-b border-slate-50 pb-2 ${isAdjustment ? '' : 'opacity-40'}">
                                <div class="flex-1">
                                    <label class="block text-xs font-bold text-gray-500 mb-1">지급대상자1 (지사장 - 재직자)</label>
                                    <select id="modalLeaderSelect" disabled class="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none cursor-pointer focus:border-primary font-bold">
                                        <option value="">(비움)</option>
                                        ${userOptions}
                                    </select>
                                </div>
                                <div class="flex items-center gap-1.5 pt-4">
                                    <input type="checkbox" id="chkLeader" ${isAdjustment ? '' : 'disabled'} class="w-4 h-4 cursor-pointer">
                                    <label for="chkLeader" class="text-xs font-bold text-slate-600 cursor-pointer select-none">수정적용</label>
                                </div>
                            </div>

                            <!-- 3. 지급대상자2 -->
                            <div class="flex items-center justify-between gap-4 border-b border-slate-50 pb-2">
                                <div class="flex-1">
                                    <label class="block text-xs font-bold text-gray-500 mb-1">지급대상자2 (FP/지급자 - 퇴사자포함)</label>
                                    <select id="modalFpSelect" disabled class="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none cursor-pointer focus:border-primary font-bold">
                                        <option value="">(비움)</option>
                                        ${allUserOptions}
                                    </select>
                                </div>
                                <div class="flex items-center gap-1.5 pt-4">
                                    <input type="checkbox" id="chkFp" class="w-4 h-4 cursor-pointer">
                                    <label for="chkFp" class="text-xs font-bold text-slate-600 cursor-pointer select-none">수정적용</label>
                                </div>
                            </div>

                            <!-- 4. 지급액2 -->
                            <div class="flex items-center justify-between gap-4 border-b border-slate-50 pb-2">
                                <div class="flex-1">
                                    <label class="block text-xs font-bold text-gray-500 mb-1">지급액2</label>
                                    <input type="text" id="modalPay2" disabled class="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary font-bold" placeholder="금액 입력">
                                </div>
                                <div class="flex items-center gap-1.5 pt-4">
                                    <input type="checkbox" id="chkPay2" class="w-4 h-4 cursor-pointer">
                                    <label for="chkPay2" class="text-xs font-bold text-slate-600 cursor-pointer select-none">수정적용</label>
                                </div>
                            </div>

                            <!-- 5. 지급비율2 -->
                            <div class="flex items-center justify-between gap-4 border-b border-slate-50 pb-2">
                                <div class="flex-1">
                                    <label class="block text-xs font-bold text-gray-500 mb-1">지급비율2</label>
                                    <div class="flex items-center gap-1.5">
                                        <input type="number" step="any" id="modalRatio2" disabled class="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-center text-sm font-bold focus:border-primary" placeholder="비율 입력">
                                        <span class="font-bold text-gray-500">%</span>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1.5 pt-4">
                                    <input type="checkbox" id="chkRatio2" class="w-4 h-4 cursor-pointer">
                                    <label for="chkRatio2" class="text-xs font-bold text-slate-600 cursor-pointer select-none">수정적용</label>
                                </div>
                            </div>
                        </div>
                        <div class="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
                            <button id="cancelBatchModalBtn" class="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium rounded-xl transition text-xs">취소</button>
                            <button id="applyBatchModalBtn" class="px-5 py-2 bg-primary hover:bg-primaryHover text-white font-bold rounded-xl transition text-xs shadow-md shadow-orange-100">적용하기</button>
                        </div>
                    </div>
                `;

                const chkContent = modal.querySelector('#chkContent');
                const modalContent = modal.querySelector('#modalContent');
                const chkLeader = modal.querySelector('#chkLeader');
                const modalLeaderSelect = modal.querySelector('#modalLeaderSelect');
                const chkFp = modal.querySelector('#chkFp');
                const modalFpSelect = modal.querySelector('#modalFpSelect');
                const chkPay2 = modal.querySelector('#chkPay2');
                const modalPay2 = modal.querySelector('#modalPay2');
                const chkRatio2 = modal.querySelector('#chkRatio2');
                const modalRatio2 = modal.querySelector('#modalRatio2');

                const applyBtn = modal.querySelector('#applyBatchModalBtn');
                const cancelBtn = modal.querySelector('#cancelBatchModalBtn');
                const closeBtn = modal.querySelector('#closeBatchModalBtn');

                modalPay2.addEventListener('input', (e) => {
                    let val = e.target.value;
                    if (val === '-' || val === '') return;
                    let raw = val.replace(/,/g, '');
                    let amt = parseInt(raw);
                    if (isNaN(amt)) amt = 0;
                    e.target.value = formatNumberWithCommas(amt);
                    updateInputNegativeColor(modalPay2, amt);
                });
                modalPay2.addEventListener('blur', () => {
                    let raw = modalPay2.value.replace(/,/g, '').trim();
                    if (raw === '' || raw === '-') {
                        modalPay2.value = '0';
                        updateInputNegativeColor(modalPay2, 0);
                    }
                });

                modalRatio2.addEventListener('input', (e) => {
                    updateInputNegativeColor(modalRatio2, modalRatio2.value);
                });
                modalRatio2.addEventListener('blur', () => {
                    let val = modalRatio2.value.trim();
                    if (val === '' || val === '-') {
                        modalRatio2.value = '0';
                        updateInputNegativeColor(modalRatio2, 0);
                    }
                });

                const setToggle = (chk, input) => {
                    chk.addEventListener('change', () => {
                        input.disabled = !chk.checked;
                        if (chk.checked) {
                            input.classList.remove('bg-slate-50');
                            input.classList.add('bg-white');
                        } else {
                            input.classList.remove('bg-white');
                            input.classList.add('bg-slate-50');
                            input.value = '';
                        }
                    });
                };
                setToggle(chkContent, modalContent);
                if (isAdjustment) setToggle(chkLeader, modalLeaderSelect);
                setToggle(chkFp, modalFpSelect);
                setToggle(chkPay2, modalPay2);
                setToggle(chkRatio2, modalRatio2);

                const closeModal = () => {
                    modal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                };
                closeBtn.addEventListener('click', closeModal);
                cancelBtn.addEventListener('click', closeModal);

                applyBtn.addEventListener('click', () => {
                    const useContent = chkContent.checked;
                    const useLeader = isAdjustment && chkLeader.checked;
                    const useFp = chkFp.checked;
                    const usePay2 = chkPay2.checked;
                    const useRatio2 = chkRatio2.checked;

                    const valContent = modalContent.value.trim();
                    const valLeaderId = modalLeaderSelect.value;
                    const valLeaderName = valLeaderId ? modalLeaderSelect.options[modalLeaderSelect.selectedIndex].text : '';
                    const valFpId = modalFpSelect.value;
                    const valFpName = valFpId ? modalFpSelect.options[modalFpSelect.selectedIndex].text : '';
                    
                    const rawPay2Val = modalPay2.value.replace(/,/g, '');
                    const valPay2 = parseInt(rawPay2Val) || 0;
                    const valRatio2 = (parseFloat(modalRatio2.value) || 0) / 100;

                    const targetKeys = [];
                    if (mode === 'selected') {
                        selectedRows.forEach(k => targetKeys.push(k));
                    } else {
                        listData.forEach(item => targetKeys.push(getRowKey(item)));
                    }

                    targetKeys.forEach(k => {
                        const row = originalMap[k];
                        if (!row) return;

                        if (!editedItems[k]) editedItems[k] = {};

                        const isRowRefund = String(row['지급/환수'] || row['구분'] || row['지급구분'] || '').includes('환수');
                        const curContent = editedItems[k]['시상내용'] !== undefined ? editedItems[k]['시상내용'] : (row['시상내용'] || '');
                        const curLeaderName = editedItems[k]['지급대상자1명'] !== undefined ? editedItems[k]['지급대상자1명'] : (row['지급대상자1명'] || '');
                        const curLeaderId = editedItems[k]['지급대상자1사번'] !== undefined ? editedItems[k]['지급대상자1사번'] : (row['지급대상자1사번'] || '');
                        const curFpName = editedItems[k]['지급대상자2명'] !== undefined ? editedItems[k]['지급대상자2명'] : (row['지급대상자2명'] || '');
                        const curFpId = editedItems[k]['지급대상자2사번'] !== undefined ? editedItems[k]['지급대상자2사번'] : (row['지급대상자2사번'] || '');
                        
                        let curPay2 = editedItems[k]['지급액2'] !== undefined ? editedItems[k]['지급액2'] : Number(row['지급액2'] || 0);
                        if (isRowRefund && curPay2 > 0) curPay2 = -curPay2;

                        let curRatio2 = editedItems[k]['지급비율2'] !== undefined ? editedItems[k]['지급비율2'] : Number(row['지급비율2'] || 0);
                        if (isRowRefund && curRatio2 > 0) curRatio2 = -curRatio2;

                        const premium = Number(row['보험료'] || 0);
                        const totalReward = isAdjustment ? Number(row['시상금'] || 0) : 0;
                        let rateFloat = Number(row['시상률'] || 0);
                        if (isRowRefund && rateFloat > 0) rateFloat = -rateFloat;

                        let finalContent = useContent ? valContent : curContent;
                        let finalLeaderId = useLeader ? valLeaderId : curLeaderId;
                        let finalLeaderName = useLeader ? valLeaderName : curLeaderName;
                        let finalFpId = useFp ? valFpId : curFpId;
                        let finalFpName = useFp ? valFpName : curFpName;

                        let targetPay2 = valPay2;
                        if (isRowRefund && targetPay2 > 0) targetPay2 = -targetPay2;
                        let targetRatio2 = valRatio2;
                        if (isRowRefund && targetRatio2 > 0) targetRatio2 = -targetRatio2;

                        let finalRatio2 = curRatio2;
                        let finalPay2 = curPay2;

                        let finalRatio1 = 0;
                        let finalPay1 = 0;

                        if (isAdjustment) {
                            if (usePay2) {
                                // [공식: 지급액2 입력 시] 시상금 = 지급액1 + 지급액2
                                finalPay2 = targetPay2;
                                finalPay1 = totalReward - finalPay2;
                                if (premium !== 0) {
                                    finalRatio2 = finalPay2 / premium;
                                    finalRatio1 = finalPay1 / premium;
                                } else {
                                    finalRatio1 = rateFloat - finalRatio2;
                                }
                            } else if (useRatio2) {
                                // [공식: 지급비율2 입력 시] 지급액2 자동계산(소수점 버림) 후 지급액1 = 시상금 - 지급액2
                                finalRatio2 = targetRatio2;
                                finalRatio1 = rateFloat - finalRatio2;
                                finalPay2 = premium !== 0 ? Math.floor(premium * finalRatio2) : 0;
                                if (isRowRefund && finalPay2 > 0) finalPay2 = -finalPay2;
                                finalPay1 = totalReward - finalPay2;
                            } else {
                                finalRatio1 = rateFloat - finalRatio2;
                                finalPay1 = totalReward - finalPay2;
                            }
                        } else {
                            if (usePay2) {
                                finalPay2 = targetPay2;
                                if (premium !== 0) {
                                    finalRatio2 = finalPay2 / premium;
                                }
                            } else if (useRatio2) {
                                finalRatio2 = targetRatio2;
                                finalPay2 = premium !== 0 ? Math.floor(premium * finalRatio2) : 0;
                                if (isRowRefund && finalPay2 > 0) finalPay2 = -finalPay2;
                            }
                        }

                        editedItems[k] = {
                            '마감월': row['마감월'],
                            '보험사': row['보험사'],
                            '증권번호': row['증권번호'],
                            '사번': row['사번'],
                            '납입회차': row['납입회차'] || '',
                            '시상률': rateFloat,
                            '시상내용': finalContent,
                            '지급대상자1명': finalLeaderName,
                            '지급대상자1사번': finalLeaderId,
                            '지급액1': finalPay1,
                            '지급비율1': finalRatio1,
                            '지급대상자2명': finalFpName,
                            '지급대상자2사번': finalFpId,
                            '지급액2': finalPay2,
                            '지급비율2': finalRatio2
                        };
                    });

                    closeModal();
                    renderTable();
                    saveAdjustBtn.disabled = false;
                    unsavedBadge.classList.remove('hidden');
                });

                document.body.classList.add('modal-open');
                modal.style.display = 'flex';
            }

            // 7. 저장 호출 연계
            saveAdjustBtn.addEventListener('click', async () => {
                const itemsToSave = Object.values(editedItems);
                if (itemsToSave.length === 0) return;

                showLoading(true);
                try {
                    const res = await callApi('saveRewardAdjustData', state.user.staffId, adjRewardType.value, itemsToSave);
                    showLoading(false);

                    if (res.error) {
                        alert('저장 오류: ' + res.message);
                    } else {
                        alert(res.message || '변경 내용이 성공적으로 저장되었습니다.\n\n(서버 부하 방지를 위해 목록이 초기화되었습니다. 계속해서 작업하시거나 필요 시 [조회] 버튼을 눌러주세요.)');
                        
                        // [서버 부하 방지] 저장 후 자동 재호출을 막고, 테이블 데이터만 깔끔하게 초기화 (필터 박스 조건은 유지)
                        listData = [];
                        editedItems = {};
                        originalMap = {};
                        selectedRows.clear();
                        if (selectAllCheckbox) selectAllCheckbox.checked = false;
                        
                        saveAdjustBtn.disabled = true;
                        batchEditBtn.disabled = true;
                        batchEditAllBtn.disabled = true;
                        unsavedBadge.classList.add('hidden');
                        
                        renderTable();
                    }
                } catch (err) {
                    showLoading(false);
                    alert('저장 처리 중 예외 발생: ' + err.toString());
                }
            });

            // 8. 대량 엑셀 업로드 인터랙션 바인딩
            dropZone.addEventListener('click', () => excelFilesInput.click());
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('border-primary/50', 'bg-orange-50/10');
            });
            dropZone.addEventListener('dragleave', () => {
                dropZone.classList.remove('border-primary/50', 'bg-orange-50/10');
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('border-primary/50', 'bg-orange-50/10');
                const files = e.dataTransfer.files;
                if (files.length > 0) handleExcelFiles(files);
            });
            excelFilesInput.addEventListener('change', (e) => {
                const files = e.target.files;
                if (files.length > 0) handleExcelFiles(files);
            });

            // 복수 파일 비동기 로컬 파싱 프로세스 (SheetJS)
            async function handleExcelFiles(files) {
                uploadedParsedRows = [];
                uploadProgressSection.classList.remove('hidden');
                updateProgressBar(0, '엑셀 파일 해석 중...');

                const fileArray = Array.from(files).filter(f => f.name.endsWith('.xlsx'));
                if (fileArray.length === 0) {
                    alert('xlsx 확장자의 엑셀 파일만 업로드할 수 있습니다.');
                    uploadProgressSection.classList.add('hidden');
                    return;
                }

                if (fileArray.length > 100) {
                    alert('한 번에 최대 100개 파일까지만 업로드할 수 있습니다.');
                    uploadProgressSection.classList.add('hidden');
                    return;
                }

                let parsedCount = 0;
                for (const file of fileArray) {
                    try {
                        const data = await readExcelFileAsync(file);
                        uploadedParsedRows = uploadedParsedRows.concat(data);
                    } catch(e) {
                        console.error(`${file.name} 파싱 실패:`, e);
                    }
                    parsedCount++;
                    const pct = Math.round((parsedCount / fileArray.length) * 50); 
                    updateProgressBar(pct, `파일 해석 중... (${parsedCount}/${fileArray.length})`);
                }

                if (uploadedParsedRows.length === 0) {
                    alert('파싱된 데이터가 존재하지 않거나 엑셀 파일이 비어 있습니다.');
                    uploadProgressSection.classList.add('hidden');
                    return;
                }

                // 저장 대상 시트 원클릭 선택 모달 노출
                showUploadTargetModal();
            }

            function readExcelFileAsync(file) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        try {
                            const data = new Uint8Array(e.target.result);
                            const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                            const firstSheetName = workbook.SheetNames[0];
                            const sheet = workbook.Sheets[firstSheetName];
                            
                            const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                            resolve(rawJson);
                        } catch(err) {
                            reject(err);
                        }
                    };
                    reader.onerror = (err) => reject(err);
                    reader.readAsArrayBuffer(file);
                });
            }

            function updateProgressBar(percent, statusText) {
                progressBar.style.width = percent + '%';
                progressPercentText.textContent = percent + '%';
                progressStatusText.textContent = statusText;
            }

            // 시상종류 선택 원클릭 모달 개편 (One-click Selection)
            function showUploadTargetModal() {
                const modalId = 'upload-target-select-modal';
                let modal = document.getElementById(modalId);
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = modalId;
                    modal.className = "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fadeIn";
                    document.body.appendChild(modal);
                }

                modal.innerHTML = `
                    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform scale-100 flex flex-col">
                        <div class="px-6 py-4 border-b border-gray-100 bg-white flex justify-between items-center">
                            <h3 class="font-bold text-base text-gray-800 flex items-center gap-1.5">
                                <span class="w-1.5 h-4.5 bg-primary rounded-full block"></span>
                                저장 대상 시트 선택
                            </h3>
                            <button id="closeUploadTargetBtn" class="p-1 text-gray-400 hover:text-gray-600 rounded-full transition">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div class="p-6 space-y-2 text-center">
                            <p class="text-xs font-bold text-gray-400 mb-4">원하는 시트를 클릭하면 즉시 데이터 적재가 시작됩니다.</p>
                            <div class="grid grid-cols-1 gap-2.5">
                                <button class="sheet-select-btn w-full py-3 bg-slate-50 hover:bg-primary hover:text-white rounded-xl text-xs font-bold text-slate-700 transition shadow-sm" data-value="2차년인센">2차년인센</button>
                                <button class="sheet-select-btn w-full py-3 bg-slate-50 hover:bg-primary hover:text-white rounded-xl text-xs font-bold text-slate-700 transition shadow-sm" data-value="생보법인">생보법인</button>
                                <button class="sheet-select-btn w-full py-3 bg-slate-50 hover:bg-primary hover:text-white rounded-xl text-xs font-bold text-slate-700 transition shadow-sm" data-value="손보법인">손보법인</button>
                                <button class="sheet-select-btn w-full py-3 bg-slate-50 hover:bg-primary hover:text-white rounded-xl text-xs font-bold text-slate-700 transition shadow-sm" data-value="생보개인">생보개인</button>
                                <button class="sheet-select-btn w-full py-3 bg-slate-50 hover:bg-primary hover:text-white rounded-xl text-xs font-bold text-slate-700 transition shadow-sm" data-value="손보개인">손보개인</button>
                            </div>
                        </div>
                    </div>
                `;

                const closeBtn = modal.querySelector('#closeUploadTargetBtn');

                const closeModal = () => {
                    modal.style.display = 'none';
                    document.body.classList.remove('modal-open');
                    uploadProgressSection.classList.add('hidden');
                };

                closeBtn.addEventListener('click', closeModal);

                // 원클릭 시 즉각 닫히며 2단계 업로드 프로세스 시작
                modal.querySelectorAll('.sheet-select-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const selectedSheet = btn.getAttribute('data-value');
                        modal.style.display = 'none';
                        document.body.classList.remove('modal-open');
                        startDataUploadProcess(selectedSheet);
                    });
                });

                document.body.classList.add('modal-open');
                modal.style.display = 'flex';
            }

            // 마감월별 Chunking 분할 덮어쓰기 로직 연계
            async function startDataUploadProcess(rewardType) {
                if (typeof pausePrefetch === 'function') pausePrefetch();
                try {
                    // 1. 유니크한 마감월 추출 (문자열 6자리 수치로 극도로 강건하게 획득)
                    const monthsInRows = [...new Set(uploadedParsedRows.map(r => {
                        let m = r['마감월'];
                        if (m instanceof Date) {
                            try {
                                const y = m.getFullYear();
                                const mm = String(m.getMonth() + 1).padStart(2, '0');
                                return `${y}${mm}`;
                            } catch(e) {}
                        }
                        let mStr = String(m || '').replace(/[^0-9]/g, '').trim();
                        if (mStr.length === 6) return mStr;

                        let dVal = r['계약일자'] || r['계약일'];
                        if (dVal instanceof Date) {
                            try {
                                const y = dVal.getFullYear();
                                const mm = String(dVal.getMonth() + 1).padStart(2, '0');
                                return `${y}${mm}`;
                            } catch(e) {}
                        }
                        let dStr = String(dVal || '').replace(/[^0-9]/g, '').trim();
                        if (dStr.length >= 6) return dStr.substring(0, 6);

                        return '';
                    }).filter(Boolean))];

                    if (monthsInRows.length === 0) {
                        monthsInRows.push(adjMonth.value);
                    }

                    // 2. 백엔드와 통신하여 각 마감월 기존 데이터 존재 유무 조사
                    updateProgressBar(60, '대상 시트의 기존 데이터 조사 중...');
                    let existOverwriteConfirmNeeded = false;
                    const existingMonths = [];

                    for (const m of monthsInRows) {
                        const checkRes = await callApi('checkExistingMonthData', state.user.staffId, rewardType, m);
                        if (!checkRes.error && checkRes.exists) {
                            existOverwriteConfirmNeeded = true;
                            existingMonths.push(m);
                        }
                    }

                    let overwrite = false;
                    if (existOverwriteConfirmNeeded) {
                        const confirmMsg = `선택하신 [${rewardType}] 시트에 아래 마감월의 기존 데이터가 이미 존재합니다.\n\n대상 마감월: ${existingMonths.join(', ')}\n\n기존 데이터를 모두 지우고 업로드한 내용으로 완전히 덮어쓰시겠습니까?\n(취소를 선택할 경우 데이터가 덮어씌워지지 않고 중단됩니다.)`;
                        if (!confirm(confirmMsg)) {
                            uploadProgressSection.classList.add('hidden');
                            return;
                        }
                        overwrite = true;
                    }

                    // 3. 마감월 단위 데이터 순차 업로드 전송 (Sequential Chunking)
                    let successCount = 0;
                    let failCount = 0;
                    let step = 0;

                    for (const m of monthsInRows) {
                        step++;
                        const progressVal = 60 + Math.round((step / monthsInRows.length) * 40);
                        updateProgressBar(progressVal, `[${rewardType}] ${m} 마감월 데이터 저장 중... (${step}/${monthsInRows.length})`);

                        const rowsForMonth = uploadedParsedRows.filter(r => {
                            let rowM = r['마감월'];
                            if (rowM instanceof Date) {
                                try {
                                    const y = rowM.getFullYear();
                                    const mm = String(rowM.getMonth() + 1).padStart(2, '0');
                                    return `${y}${mm}` === m;
                                } catch(e) {}
                            }
                            let mStr = String(rowM || '').replace(/[^0-9]/g, '').trim();
                            if (mStr.length === 6) return mStr === m;

                            let d = String(r['계약일자'] || r['계약일'] || '').replace(/[^0-9]/g, '').trim();
                            if (d.length >= 6) return d.substring(0, 6) === m;
                            return m === adjMonth.value; 
                        });

                        if (rowsForMonth.length === 0) continue;

                        const saveRes = await callApi('uploadRewardExcelData', state.user.staffId, rewardType, m, rowsForMonth);
                        if (!saveRes.error && saveRes.success) {
                            successCount += rowsForMonth.length;
                        } else {
                            console.error(`${m} 마감월 전송 실패:`, saveRes.message);
                            failCount += rowsForMonth.length;
                        }
                    }

                    // 완료 안내 및 UI 갱신 (자동 선택 및 필터 설정)
                    updateProgressBar(100, '모든 데이터 저장 완료!');
                    setTimeout(() => {
                        uploadProgressSection.classList.add('hidden');
                        alert(`엑셀 대량 업로드 처리가 완료되었습니다.\n\n* 저장 성공: ${successCount}건\n* 저장 실패: ${failCount}건\n\n필터 조건이 업로드된 마감월로 설정되었습니다. 필요 시 [조회] 버튼을 눌러 확인하세요.`);
                        
                        // 업로드한 종류와 마감월로 필터 동적 자동 전환
                        if (monthsInRows.length > 0) {
                            const latestMonth = monthsInRows.sort().reverse()[0];
                            
                            // 해당 마감월이 셀렉트박스 옵션에 없는 경우 동적으로 옵션 노드 추가 (공란화 버그 방지)
                            let exists = false;
                            for (let i = 0; i < adjMonth.options.length; i++) {
                                if (adjMonth.options[i].value === latestMonth) {
                                    exists = true;
                                    break;
                                }
                            }
                            
                            if (!exists) {
                                const opt = document.createElement('option');
                                opt.value = latestMonth;
                                opt.textContent = latestMonth;
                                
                                // 내림차순 정렬 유지를 위해 알맞은 위치에 삽입
                                let inserted = false;
                                for (let i = 0; i < adjMonth.options.length; i++) {
                                    if (latestMonth > adjMonth.options[i].value) {
                                        adjMonth.insertBefore(opt, adjMonth.options[i]);
                                        inserted = true;
                                        break;
                                    }
                                }
                                if (!inserted) {
                                    adjMonth.appendChild(opt);
                                }
                            }
                            
                            adjRewardType.value = rewardType;
                            adjMonth.value = latestMonth;
                        }
                        
                        // 데이터 목록 초기화
                        listData = [];
                        editedItems = {};
                        originalMap = {};
                        selectedRows.clear();
                        if (selectAllCheckbox) selectAllCheckbox.checked = false;
                        saveAdjustBtn.disabled = true;
                        batchEditBtn.disabled = true;
                        batchEditAllBtn.disabled = true;
                        unsavedBadge.classList.add('hidden');
                        renderTable();
                    }, 500);
                } catch (err) {
                    uploadProgressSection.classList.add('hidden');
                    alert('업로드 처리 중 오류 발생: ' + err.toString());
                }
            }

            adjSearchBtn.addEventListener('click', fetchAdjustData);

            return container;
        }
