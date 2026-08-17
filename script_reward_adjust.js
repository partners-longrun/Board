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

            // 천원 단위 쉼표 포맷 헬퍼
            function formatNumberWithCommas(val) {
                if (val === undefined || val === null || val === '') return '0';
                let clean = String(val).replace(/[^0-9-]/g, '');
                if (!clean) return '0';
                return Number(clean).toLocaleString('ko-KR');
            }

            // 1. 헤더 영역 및 검색 필터 패널
            container.innerHTML = `
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                        <div>
                            <h2 class="text-xl font-bold text-gray-900 flex items-center gap-2">
                                <span class="w-1.5 h-5 bg-primary rounded-full block"></span>
                                시상 조정
                            </h2>
                            <p class="text-xs text-gray-500 mt-1">시상 지급 대상을 검색/변경하고 비율 및 지급액을 조정합니다. (지사대표 전용)</p>
                        </div>
                    </div>

                    <!-- 검색 필터바 -->
                    <div class="grid grid-cols-2 md:grid-cols-7 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200/50 items-end">
                        <div>
                            <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">시상종류</label>
                            <select id="adjRewardType" class="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition cursor-pointer">
                                <option value="2차년인센">2차년인센</option>
                                <option value="생보법인">생보법인</option>
                                <option value="손보법인">손보법인</option>
                                <option value="생보개인">생보개인</option>
                                <option value="손보개인">손보개인</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">마감월</label>
                            <select id="adjMonth" class="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition cursor-pointer">
                                ${state.months.map(m => `<option value="${m}" ${m === state.currentMonth ? 'selected' : ''}>${m}</option>`).join('')}
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
                        <div>
                            <label class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">구분</label>
                            <select id="adjPayRefund" class="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-2 text-sm font-medium focus:ring-1 focus:ring-primary focus:border-primary outline-none transition cursor-pointer">
                                <option value="전체">전체</option>
                                <option value="지급">지급</option>
                                <option value="환수">환수</option>
                            </select>
                        </div>
                        <div class="col-span-2 md:col-span-1 flex justify-end">
                            <button id="adjSearchBtn" class="w-full px-5 py-2.5 bg-secondary hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition shadow-sm h-[38px]">
                                조회하기
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 2단계: 엑셀 파일 대량 업로드 영역 (초간소화 높이 최소화 슬림 레이아웃) -->
                <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                    <div id="dropZone" class="border-2 border-dashed border-slate-200 hover:border-primary/50 hover:bg-orange-50/5 rounded-xl p-3 text-center cursor-pointer transition flex items-center justify-center gap-2">
                        <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                        <span class="text-xs text-gray-500 font-bold">여기에 엑셀 파일들을 드래그하거나 클릭하여 업로드하세요. (최대 100개)</span>
                        <input type="file" id="excelFilesInput" multiple accept=".xlsx" class="hidden">
                    </div>

                    <!-- 업로드 파일 목록 및 전송 진행 바 -->
                    <div id="uploadProgressSection" class="hidden space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200/50 mt-3">
                        <div class="flex items-center justify-between text-xs font-bold text-gray-600">
                            <span id="progressStatusText">대기 중...</span>
                            <span id="progressPercentText">0%</span>
                        </div>
                        <div class="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                            <div id="progressBar" class="bg-primary h-full transition-all duration-200" style="width: 0%;"></div>
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
                                    <th style="width: 85px; min-width: 85px; white-space: nowrap;" class="p-3 font-mono">계약일</th>
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

            // DOM 요소 선택
            const adjRewardType = container.querySelector('#adjRewardType');
            const adjMonth = container.querySelector('#adjMonth');
            const adjCompany = container.querySelector('#adjCompany');
            const adjBranch = container.querySelector('#adjBranch');
            const adjAgent = container.querySelector('#adjAgent');
            const adjPayRefund = container.querySelector('#adjPayRefund');
            const adjSearchBtn = container.querySelector('#adjSearchBtn');
            const adjTableBody = container.querySelector('#adjTableBody');
            const adjResultCount = container.querySelector('#adjResultCount');
            const selectAllCheckbox = container.querySelector('#selectAllCheckbox');
            const batchEditBtn = container.querySelector('#batchEditBtn');
            const batchEditAllBtn = container.querySelector('#batchEditAllBtn');
            const saveAdjustBtn = container.querySelector('#saveAdjustBtn');
            const unsavedBadge = container.querySelector('#unsavedBadge');

            const dropZone = container.querySelector('#dropZone');
            const excelFilesInput = container.querySelector('#excelFilesInput');
            const uploadProgressSection = container.querySelector('#uploadProgressSection');
            const progressStatusText = container.querySelector('#progressStatusText');
            const progressPercentText = container.querySelector('#progressPercentText');
            const progressBar = container.querySelector('#progressBar');

            // 시상종류 변경 시 필터값 초기화
            adjRewardType.addEventListener('change', () => {
                adjCompany.innerHTML = '<option value="전체">전체</option>';
                adjBranch.innerHTML = '<option value="전체">전체</option>';
            });

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
                listData.forEach(item => {
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

            function getRowKey(row) {
                const m = String(row['마감월'] || '').trim();
                const c = String(row['보험사'] || '').trim();
                const p = String(row['증권번호'] || '').trim();
                const a = String(row['사번'] || '').trim();
                const r = String(row['납입회차'] || '').trim();
                return `${m}_${c}_${p}_${a}_${r}`;
            }

            // 3. 테이블 드로우 함수
            function renderTable() {
                adjTableBody.innerHTML = '';
                adjResultCount.textContent = listData.length;

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

                    // 상태 값 매핑 (수정본 or 원본)
                    const curContent = isEdited && editedItems[key]['시상내용'] !== undefined ? editedItems[key]['시상내용'] : (row['시상내용'] || '');
                    
                    const curLeaderName = isEdited && editedItems[key]['지급대상자1명'] !== undefined ? editedItems[key]['지급대상자1명'] : (row['지급대상자1명'] || '');
                    const curLeaderId = isEdited && editedItems[key]['지급대상자1사번'] !== undefined ? editedItems[key]['지급대상자1사번'] : (row['지급대상자1사번'] || '');
                    
                    const curFpName = isEdited && editedItems[key]['지급대상자2명'] !== undefined ? editedItems[key]['지급대상자2명'] : (row['지급대상자2명'] || '');
                    const curFpId = isEdited && editedItems[key]['지급대상자2사번'] !== undefined ? editedItems[key]['지급대상자2사번'] : (row['지급대상자2사번'] || '');

                    const curPay1 = isEdited && editedItems[key]['지급액1'] !== undefined ? editedItems[key]['지급액1'] : (row['지급액1'] !== '' ? Number(row['지급액1']) : '');
                    const curPay2 = isEdited && editedItems[key]['지급액2'] !== undefined ? editedItems[key]['지급액2'] : Number(row['지급액2'] || 0);

                    const curRatio1 = isEdited && editedItems[key]['지급비율1'] !== undefined ? editedItems[key]['지급비율1'] : (row['지급비율1'] !== '' ? Number(row['지급비율1']) : '');
                    const curRatio2 = isEdited && editedItems[key]['지급비율2'] !== undefined ? editedItems[key]['지급비율2'] : Number(row['지급비율2'] || 0);

                    const cleanPayRefund = String(row['지급/환수'] || '').replace(/\s+/g, '');
                    const isPay = cleanPayRefund.includes('지급');
                    const badgeClass = isPay ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100';

                    // 시상률 백분율 포맷
                    const rateFloat = Number(row['시상률'] || 0);
                    const ratePercentText = Math.round(rateFloat * 100) + '%';

                    // 지급대상자1 (지사장 - 재직자 목록 그대로 유지)
                    const selectLeaderHtml = isAdjustment ? `
                        <select class="leader-select bg-transparent border border-gray-200 rounded px-1 py-0.5 w-20 focus:bg-white focus:border-primary outline-none cursor-pointer text-xs font-semibold">
                            <option value="">(없음)</option>
                            ${userList.map(u => `<option value="${u.id}" ${String(u.id) === String(curLeaderId) ? 'selected' : ''}>${u.name}</option>`).join('')}
                        </select>
                    ` : `<span class="text-gray-400 font-medium">해당없음</span>`;

                    // 지급대상자2 (FP - 퇴사자 포함 전체 목록 allUserList 주입)
                    const selectFpHtml = `
                        <select class="fp-select bg-transparent border border-gray-200 rounded px-1 py-0.5 w-20 focus:bg-white focus:border-primary outline-none cursor-pointer text-xs font-semibold">
                            <option value="">(없음)</option>
                            ${allUserList.map(u => `<option value="${u.id}" ${String(u.id) === String(curFpId) ? 'selected' : ''}>${u.name}</option>`).join('')}
                        </select>
                    `;

                    // 금액 및 비율 포맷팅
                    const rewardAmtText = isAdjustment ? formatMoney(row['시상금']) : '-';
                    const pay1Text = (isAdjustment && curPay1 !== '') ? formatMoney(curPay1) : '-';
                    const ratio1Text = (isAdjustment && curRatio1 !== '') ? Math.round(curRatio1 * 100) + '%' : '-';

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
                        <td class="p-3 text-right font-bold text-slate-500">${formatMoney(row['보험료'])}</td>
                        <td class="p-3 text-gray-600 max-w-[120px] truncate" title="${row['상품명'] || ''}">${row['상품명'] || ''}</td>
                        
                        <!-- 5개 수정 가능 열 및 연동 셀 -->
                        <td class="p-2"><input type="text" class="content-input w-28 border border-gray-200 rounded px-1.5 py-0.5" value="${curContent}"></td>
                        <td class="p-3 text-right font-bold text-gray-800">${rewardAmtText}</td>
                        <td class="p-3 text-center font-bold text-indigo-600">${ratePercentText}</td>
                        
                        <td class="p-2">${selectLeaderHtml}</td>
                        <td class="p-3 text-right font-bold text-slate-700 pay1-cell">${pay1Text}</td>
                        <td class="p-3 text-center font-bold text-gray-600 ratio1-cell">${ratio1Text}</td>
                        
                        <td class="p-2">${selectFpHtml}</td>
                        <td class="p-2 text-right">
                            <input type="text" class="pay2-input w-20 border border-gray-200 rounded px-1.5 py-0.5 text-right font-bold" value="${formatNumberWithCommas(curPay2)}">
                        </td>
                        <td class="p-2 text-center">
                            <div class="flex items-center gap-0.5 justify-center">
                                <input type="number" min="0" class="ratio2-input w-12 border border-gray-200 rounded px-1 py-0.5 text-center font-bold" value="${Math.round(curRatio2 * 100)}">%
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

                    const handleEditing = () => {
                        if (!editedItems[key]) editedItems[key] = {};

                        const valContent = contentEl.value.trim();
                        const valLeaderId = selectLeaderEl ? selectLeaderEl.value : '';
                        const valLeaderName = valLeaderId ? selectLeaderEl.options[selectLeaderEl.selectedIndex].text : '';
                        const valFpId = selectFpEl.value;
                        const valFpName = valFpId ? selectFpEl.options[selectFpEl.selectedIndex].text : '';
                        
                        const rawPay2Val = pay2El.value.replace(/,/g, '');
                        const valPay2 = parseInt(rawPay2Val) || 0;
                        const valRatio2 = (parseFloat(ratio2El.value) || 0) / 100;

                        let finalRatio2 = valRatio2;
                        let finalPay2 = valPay2;
                        let finalRatio1 = 0;
                        let finalPay1 = 0;

                        if (isAdjustment) {
                            finalRatio1 = rateFloat - finalRatio2;
                            finalPay1 = premium !== 0 ? Math.round(premium * finalRatio1) : (totalReward - finalPay2);
                            
                            ratio1Cell.textContent = Math.round(finalRatio1 * 100) + '%';
                            pay1Cell.innerHTML = formatMoney(finalPay1);
                        }

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
                    };

                    contentEl.addEventListener('input', handleEditing);
                    if (selectLeaderEl) selectLeaderEl.addEventListener('change', handleEditing);
                    selectFpEl.addEventListener('change', handleEditing);

                    // 지급비율2 변경 시 연동
                    ratio2El.addEventListener('input', () => {
                        let r2 = parseFloat(ratio2El.value) || 0;
                        if (r2 < 0) r2 = 0;
                        
                        let p2 = premium !== 0 ? Math.round(premium * (r2 / 100)) : 0;
                        pay2El.value = formatNumberWithCommas(p2);
                        handleEditing();
                    });

                    // 지급액2 변경 시 연동
                    pay2El.addEventListener('input', (e) => {
                        let raw = e.target.value.replace(/,/g, '');
                        let p2 = parseInt(raw) || 0;
                        if (p2 < 0) p2 = 0;
                        
                        e.target.value = formatNumberWithCommas(p2);

                        if (premium !== 0) {
                            let r2 = (p2 / premium) * 100;
                            ratio2El.value = r2.toFixed(2);
                        }
                        handleEditing();
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
                
                // 지급대상자2 일괄적용용 퇴사자 포함 전체 옵션 리스트
                const allUserOptions = allUserList.map(u => `<option value="${u.id}">${u.name}</option>`).join('');

                modal.innerHTML = `
                    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform scale-100 flex flex-col">
                        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-white">
                            <h3 class="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <span class="w-1.5 h-5 bg-primary rounded-full block"></span>
                                일괄 조정 (${mode === 'selected' ? '선택' : '전체'} ${targetCount}건)
                            </h3>
                            <button id="closeBatchModalBtn" class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div class="p-6 space-y-4 text-left text-sm max-h-[400px] overflow-y-auto">
                            <p class="text-xs text-slate-400 font-bold mb-2">* 우측의 '수정적용' 체크를 활성화한 항목만 일괄 변경됩니다.</p>
                            
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
                                        <input type="number" id="modalRatio2" disabled min="0" max="100" class="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-center text-sm font-bold focus:border-primary" placeholder="비율 입력">
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
                    let raw = e.target.value.replace(/,/g, '');
                    let amt = parseInt(raw) || 0;
                    if (amt < 0) amt = 0;
                    e.target.value = formatNumberWithCommas(amt);
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

                        const curContent = editedItems[k]['시상내용'] !== undefined ? editedItems[k]['시상내용'] : (row['시상내용'] || '');
                        const curLeaderName = editedItems[k]['지급대상자1명'] !== undefined ? editedItems[k]['지급대상자1명'] : (row['지급대상자1명'] || '');
                        const curLeaderId = editedItems[k]['지급대상자1사번'] !== undefined ? editedItems[k]['지급대상자1사번'] : (row['지급대상자1사번'] || '');
                        const curFpName = editedItems[k]['지급대상자2명'] !== undefined ? editedItems[k]['지급대상자2명'] : (row['지급대상자2명'] || '');
                        const curFpId = editedItems[k]['지급대상자2사번'] !== undefined ? editedItems[k]['지급대상자2사번'] : (row['지급대상자2사번'] || '');
                        
                        const curPay2 = editedItems[k]['지급액2'] !== undefined ? editedItems[k]['지급액2'] : Number(row['지급액2'] || 0);
                        const curRatio2 = editedItems[k]['지급비율2'] !== undefined ? editedItems[k]['지급비율2'] : Number(row['지급비율2'] || 0);

                        const premium = Number(row['보험료'] || 0);
                        const totalReward = isAdjustment ? Number(row['시상금'] || 0) : 0;
                        const rateFloat = Number(row['시상률'] || 0);

                        let finalContent = useContent ? valContent : curContent;
                        let finalLeaderId = useLeader ? valLeaderId : curLeaderId;
                        let finalLeaderName = useLeader ? valLeaderName : curLeaderName;
                        let finalFpId = useFp ? valFpId : curFpId;
                        let finalFpName = useFp ? valFpName : curFpName;

                        let finalRatio2 = curRatio2;
                        let finalPay2 = curPay2;

                        if (usePay2) {
                            finalPay2 = valPay2;
                            if (premium !== 0) {
                                finalRatio2 = finalPay2 / premium;
                            }
                        } else if (useRatio2) {
                            finalRatio2 = valRatio2;
                            if (premium !== 0) {
                                finalPay2 = Math.round(premium * finalRatio2);
                            }
                        }

                        let finalRatio1 = 0;
                        let finalPay1 = 0;

                        if (isAdjustment) {
                            finalRatio1 = rateFloat - finalRatio2;
                            finalPay1 = premium !== 0 ? Math.round(premium * finalRatio1) : (totalReward - finalPay2);
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
                const res = await callApi('saveRewardAdjustData', state.user.staffId, adjRewardType.value, itemsToSave);
                showLoading(false);

                if (res.error) {
                    alert('저장 오류: ' + res.message);
                } else {
                    alert(res.message || '변경 내용이 성공적으로 저장되었습니다.');
                    fetchAdjustData();
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
                // 1. 유니크한 마감월 추출
                const monthsInRows = [...new Set(uploadedParsedRows.map(r => {
                    let m = r['마감월'];
                    if (m instanceof Date) {
                        try {
                            const y = m.getFullYear();
                            const mm = String(m.getMonth() + 1).padStart(2, '0');
                            return `${y}${mm}`;
                        } catch(e) {}
                    }
                    if (m && String(m).trim().length === 6) return String(m).trim();
                    let d = String(r['계약일자'] || r['계약일'] || '').replace(/[^0-9]/g, '');
                    if (d.length >= 6) return d.substring(0, 6);
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
                        if (rowM && String(rowM).trim().length === 6) return String(rowM).trim() === m;
                        let d = String(r['계약일자'] || r['계약일'] || '').replace(/[^0-9]/g, '');
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

                // 완료 안내 및 UI 갱신
                updateProgressBar(100, '모든 데이터 저장 완료!');
                setTimeout(() => {
                    uploadProgressSection.classList.add('hidden');
                    alert(`엑셀 대량 업로드 처리가 완료되었습니다.\n\n* 저장 성공: ${successCount}건\n* 저장 실패: ${failCount}건`);
                    
                    // 업로드한 종류와 마감월로 자동 선택
                    if (monthsInRows.length > 0) {
                        const latestMonth = monthsInRows.sort().reverse()[0];
                        adjRewardType.value = rewardType;
                        adjMonth.value = latestMonth;
                    }
                    fetchAdjustData();
                }, 800);
            }

            adjSearchBtn.addEventListener('click', fetchAdjustData);

            return container;
        }
