import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import * as TWEEN from "tween"

const ROOM_WIDTH = 20,
  ROOM_HEIGHT = 8,
  ROOM_DEPTH = 20
const CAMERA_FOV = 75,
  CAMERA_NEAR = 0.1,
  CAMERA_FAR = 1000
const INITIAL_CAMERA_POS = new THREE.Vector3(0, ROOM_HEIGHT, -ROOM_DEPTH * 1.5)
const ZOOM_DISTANCE = 6,
  CAMERA_DURATION = 1000
const ZOOM_DISTANCE_CLOSER = 3 // 두 번째 줌 거리 추가
const PAINTING_WIDTH_LIMIT = ROOM_WIDTH / 4,
  PAINTING_HEIGHT_LIMIT = ROOM_HEIGHT / 3
const PAINTING_Y_OFFSET = 0,
  WALL_OFFSET = 0.01

let paintingsData = []; // 이제 외부에서 불러옴  

let scene, camera, renderer, controls, raycaster, pointer
let paintings = [],
  currentPaintingIndex = -1
let isCameraMoving = false,
  isZoomedIn = false
let zoomedPainting = null // 현재 줌인된 그림을 저장할 변수
let zoomLevel = 0 // 줌 레벨 (0: 초기, 1: 1차 줌, 2: 2차 줌)

let skipCancelBackground = false;   // 확인(Apply)을 눌렀을 때만 true

let draggedIntroType = null;
let isIntroMode = false;  // 전시서문쓰기모드 여부
let editingIntroMesh = null; // 현재 편집중인 mesh 저장
let quill = null; // Quill 에디터 인스턴스
const introTextEditorOverlay = document.getElementById("introTextEditorOverlay");

// Quill 오버레이 내부 클릭 시 이벤트 전파 막기 (이벤트 캡처링 방지)
introTextEditorOverlay.addEventListener('mousedown', e => e.stopPropagation());

let editingIntroHTML = null; // 편집 중인 전시서문 HTML 저장용
let prevCameraPos = null;
let prevControlsTarget = null;
let originalIntroState = []; // 전시서문쓰기패널 진입 시점 상태 저장
let tempIntroMeshes = [];
let skipCancelIntro = false;
let isColorPicking = false;   // 프레임 팔레트 열림 여부


let isPaintingMode = false // 설정창 "작품선택" 모드인지 여부
let originalPaintings = [] // 이전 상태 저장용
let originalPaintingsState = [] // 작품선택 모드 진입 시 위치/회전 저장
let tempPaintings = [] // 임시 배치 그림들

let selectedPainting = null

let editingPainting = null
let isEditingPainting = false
let dragging = false

let dragStartPos = null // 드래그 시작 시 위치 저장

let pointerDownTime = 0;          // pointerdown 시각
let dragStartScreen = null;       // pointerdown 위치
let dragThreshold = 7;            // 픽셀 (7px 이상 움직이면 드래그로 간주)
let clickTimeThreshold = 200;     // ms (200ms 이하면 클릭으로 간주)
let wasDragging = false;  // 바로 직전 드래그였는지 체크

let outlineLine = null; // 선택된 작품 테우리 효과를 위한 변수

let isDragging = false;     // 드래그 중 여부
let isResizingPainting = false;   // 크기조절 모드 여부

// ───── 드래그 핸들러용 전역 상태 ─────
let resizeHandleMesh;           // 핸들러 메쉬
let isResizingWithHandle = false;
const dragPlane = new THREE.Plane();
const dragStartPoint = new THREE.Vector3();
const dragCurrentPoint = new THREE.Vector3();



let editingButtonsDiv = document.getElementById("paintingEditButtons"); // 하단 버튼 컨테이너
// 편집버튼 클릭 시, 이벤트 전파 차단 (편집 종료 안 되게!)
editingButtonsDiv.addEventListener("mousedown", function(e) {
  e.stopPropagation();
});

let isStoryEditing = false;

let skipCancelPainting = false // 설정 패널 전환 시 복원 스킵할지 여부

let isArtwallMode      = false;      // 아트월 편집 모드 진입 여부
let dragStartArt       = null;       // pointerdown에서 마우스 좌표 기록
let pointerDownArtTime = 0;          // pointerdown 시간 기록
let isDraggingArt      = false;      // 드래그 중 여부
let selectedArtwall    = null;       // 현재 마우스로 선택한 아트월 Mesh
let editingArtwall     = null;       // 현재 편집(삭제 버튼) 중인 아트월 Mesh
let artwalls      = [];      // 확정된 아트월 Mesh
let tempArtwalls  = [];      // 편집 중 임시 Mesh
let originalArtwallsState = [];  // 롤백용
let artwallsData  = [];              // [{filename, title, …}, …]
let currentArtwallsPage = 0;
const artwallsItemsPerPage = 3;

let currentPage = 0;
const itemsPerPage = 9;

/* 메타데이터 JSON 로드 */
fetch("https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/artwalls/metadata_artwalls.json")
  .then(r => r.json())
  .then(json => artwallsData = json)
  .catch(() => alert("아트월 정보를 불러오지 못했습니다!"));

/* 정렬 호출을 디바운스로 감싸는 유틸 */
let sortDebounce = null;
function safeUpdatePaintingOrder(delay = 50) {
  clearTimeout(sortDebounce);
  sortDebounce = setTimeout(updatePaintingOrderByPosition, delay);
}
/* ──────────────────────────────*/


function globalInputBlocker(e) {
  if (isResizingPainting) {
    // ★여기서 포인터 이벤트 허용 조건을 확장★
    if (
      e.target.classList.contains("scale-btn") ||
      e.target.id === "resizeOkBtn" ||
      e.target.id === "resizeCancelBtn" ||
      e.target.closest(".scale-btn") ||
      e.target.closest("#resizeOkBtn") ||
      e.target.closest("#resizeCancelBtn") ||
      // 수정: 모든 pointer 이벤트 허용
      e.type.startsWith("pointer")
    ) {
      return;  // 이 경우만 이벤트 통과
    }
    e.stopPropagation();
    e.preventDefault();
    return;
  }
 
  


  if (isStoryEditing) {
    const overlay = document.getElementById('paintingStoryEditorOverlay');
    // overlay 내부 요소가 아닌 곳은 모두 막는다
    if (!overlay || !overlay.contains(e.target)) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
  }
      // ─── 프레임 색상 팔레트가 열려 있으면 ───
  if (isColorPicking) {
    const palette = document.getElementById('frameColorPalette');
    if (!palette || !palette.contains(e.target)) {   // 팔레트 바깥이면 차단
      e.stopPropagation();
      e.preventDefault();
      return;
    }
  }
    
  // 작품선택모드 + infoModal 열려있을 때 infoModal 외부 클릭 차단!
  if (
    isPaintingMode &&
    document.getElementById('infoModal').style.display === 'block'
  ) {
    const modal = document.getElementById('infoModal');
    // infoModal 내부 클릭은 허용, 외부만 차단
    if (!modal.contains(e.target)) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
  }

  const introOverlay = document.getElementById('introTextEditorOverlay');
  if (introOverlay && introOverlay.style.display !== 'none') {
    // 오버레이 내부만 허용, 나머지는 차단
    if (!introOverlay.contains(e.target)) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
  }
}

// 모든 주요 입력 이벤트에 대해 캡처링 단계에서 globalResizeBlocker를 등록
["mousedown", "mouseup", "click", "pointerdown", "pointerup"].forEach(type => {
  document.addEventListener(type, globalInputBlocker, true);
});

const textureLoader = new THREE.TextureLoader()

async function init() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xffe6cf)

  camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    window.innerWidth / window.innerHeight,
    CAMERA_NEAR,
    CAMERA_FAR,
  )
  camera.position.copy(INITIAL_CAMERA_POS)
  camera.lookAt(0, PAINTING_Y_OFFSET, 0)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(window.devicePixelRatio) // 픽셀 비율 설정
  renderer.setSize(window.innerWidth, window.innerHeight)
  document.body.appendChild(renderer.domElement)

  // 드래그앤드롭 이벤트 등록
  renderer.domElement.addEventListener("dragover", (e) => {
    e.preventDefault(); // 기본 동작 방지
  });

  renderer.domElement.addEventListener("drop", (e) => {
    e.preventDefault();
    /* ---- (0) 아트월 썸네일 드롭 ---- */
    const artRaw = e.dataTransfer.getData("artwall");
    if (artRaw) {
      const wallData = JSON.parse(artRaw);

      // 벽면 중앙 좌표 계산
      const wallMesh = scene.getObjectByName(currentWall);
      if (!wallMesh) return;

      const wallCenter = new THREE.Vector3();
      new THREE.Box3().setFromObject(wallMesh).getCenter(wallCenter);

      const wallZ = ROOM_DEPTH / 2 - 0.01;
      const wallX = ROOM_WIDTH / 2 - 0.01;

      let fixedPos = new THREE.Vector3();
      let rotY = 0;

      switch (currentWall) {
        case "front":
          fixedPos.set(0, 0, wallZ);
          rotY = Math.PI;
          break;
        case "back":
          fixedPos.set(0, 0, -wallZ);
          rotY = 0;
          break;
        case "left":
          fixedPos.set(wallX, 0, 0);
          rotY = -Math.PI / 2;
          break;
        case "right":
          fixedPos.set(-wallX, 0, 0);
          rotY = Math.PI / 2;
          break;
      }

      loadAndAddArtwall(wallData, fixedPos, rotY, true).then(m => tempArtwalls.push(m));
      return;
    }

    // (1) 그림(작품) 드래그앤드롭
    const paintingRaw = e.dataTransfer.getData("painting");
    if (paintingRaw) {
      let paintingData;
      try {
        paintingData = JSON.parse(paintingRaw);
      } catch (err) {
        console.error("Invalid painting data:", err);
        return;
      }
      console.log("Dropped painting:", paintingData);

      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );

      raycaster.setFromCamera(mouse, camera);

      const wallMesh = scene.getObjectByName(currentWall);
      console.log("currentWall:", currentWall, "wallMesh:", wallMesh);
      if (!wallMesh) {
        alert("벽을 찾을 수 없습니다. wall-nav 벽 이름 확인!");
        draggedIntroType = null; // 그림 드롭 실패시 초기화
        return;
      }

      const intersects = raycaster.intersectObject(wallMesh);
      console.log("Intersects:", intersects);

      if (intersects.length > 0) {
        const point = intersects[0].point.clone();
        const normal = intersects[0].face.normal
          .clone()
          .transformDirection(wallMesh.matrixWorld);
        point.add(normal.multiplyScalar(0.05));

        // 벽 안쪽에 위치 제한
        const halfW = ROOM_WIDTH / 2;
        const halfH = ROOM_HEIGHT / 2;
        const halfD = ROOM_DEPTH / 2;
        const margin = 1;

        switch (currentWall) {
          case "front":
          case "back":
            point.x = THREE.MathUtils.clamp(point.x, -halfW + margin, halfW - margin);
            point.y = THREE.MathUtils.clamp(point.y, -halfH + margin, halfH - margin);
            break;
          case "left":
          case "right":
            point.z = THREE.MathUtils.clamp(point.z, -halfD + margin, halfD - margin);
            point.y = THREE.MathUtils.clamp(point.y, -halfH + margin, halfH - margin);
            break;
        }

        const wallRotY = {
          front: Math.PI,
          back: 0,
          left: -Math.PI / 2,
          right: Math.PI / 2,
        }[currentWall];

        loadAndAddPainting(paintingData, point, wallRotY).then((mesh) => {
          tempPaintings.push(mesh); // 나중에 제거할 대상 추적
        });
      } else {
        console.warn("No intersection with wall.");
      }
      return; // 그림 작업 끝, 아래 intro용 드롭 실행 안함
    }

    // (2) 전시서문 프레임/플레인 드래그앤드롭
    if (typeof draggedIntroType !== "undefined" && draggedIntroType) {
      // draggedIntroType은 전역에서 썸네일 dragstart 때 "frame" 또는 "plane" 값으로 세팅
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);

      const wallMesh = scene.getObjectByName(currentWall);
      if (!wallMesh) {
        alert("벽을 찾을 수 없습니다. wall-nav 벽 이름 확인!");
        draggedIntroType = null;
        return;
      }

      const intersects = raycaster.intersectObject(wallMesh);
      if (intersects.length === 0) {
        draggedIntroType = null;
        return;
      }
      const point = intersects[0].point.clone();

      if (draggedIntroType === "frame") {
        createIntroFrameBoxAt(point, currentWall);
      } else if (draggedIntroType === "plane") {
        createIntroWallPlaneAt(point, currentWall);
      }
      draggedIntroType = null;
      return;
    }

    // (3) 필요시, 다른 드롭 타입이 있다면 여기에 추가...
  });


  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, PAINTING_Y_OFFSET, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.1
  controls.rotateSpeed = 0.5
  controls.zoomSpeed = 1.0
  controls.panSpeed = 0.4
  controls.update()

  raycaster = new THREE.Raycaster()
  pointer = new THREE.Vector2()

  const start = Date.now()

  createRoom()
  // await placePaintings() // 작품 자동 배치
  addLights()

  const elapsed = Date.now() - start
  const minDuration = 1000
  const remaining = Math.max(0, minDuration - elapsed)

  setTimeout(() => {
    document.getElementById("loadingScreen").classList.add("hidden")
    showInstructions()
  }, remaining)

  document
    .getElementById("instructionOverlay")
    .addEventListener("click", hideInstructions)
  document.getElementById("leftButton").addEventListener("click", navigateLeft)
  document
    .getElementById("rightButton")
    .addEventListener("click", navigateRight)
  document.getElementById("infoButton").onclick = () => {
    const modal = document.getElementById("infoModal")
    const isVisible = modal.style.display === "block"
    if (isVisible) {
      closeInfo()
    } else {
      showInfo()
    }
    /* 작품선택 모드일 때만 상세 정보 덮어쓰기 */
    if (isPaintingMode && selectedPainting) {
      updatePaintingInfo(selectedPainting);   // 이제 mesh 하나만 넘김
    }
  }
  document
    .getElementById("closeInfoButton")
    .addEventListener("click", closeInfo)
  renderer.domElement.addEventListener("click", onClick)

  /*
  // 작품선택모드 에서 클릭 시 개별 그림 편집 시작 (더블클릭 핸들링)
  renderer.domElement.addEventListener("click", (event) => {
    if (!isPaintingMode) return
    if (isDragging) return // 드래그 중이면 클릭무시

    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(paintings)

    if (hits.length > 0) {
      const mesh = hits[0].object

      if (editingPainting && editingPainting !== mesh) {
        endEditingPainting() // 이전 그림 편집 종료
      }

      if (editingPainting !== mesh) {
        startEditingPainting(mesh) // 새 그림 편집 시작
      }

      // 선택과 동시에 바로 드래그 시작!
      if (isEditingPainting && editingPainting) {
        dragging = true
        dragStartPos = editingPainting.position.clone()
      }
    } else {
      endEditingPainting(); // 그림이 아닌 곳 클릭 시 편집 종료 -> 버튼 숨김
    }
  }) 
  // 만약 작품선택모드 외에서도 click이 쓰여야 한다면
  다음처럼 분리 : 
  전시관 관람모드 (isPaintingMode === false) → click/onClick 사용 가능
  작품선택모드 (isPaintingMode === true) → 오직 pointerdown/move/up만
  */  

  renderer.domElement.addEventListener("dblclick", onDoubleClick)

  // 마우스 드래그로 그림 위치 이동
  renderer.domElement.addEventListener("pointerdown", (e) => {

    if (isResizingWithHandle || isResizingPainting) return; // 크기조절 중이면 무시
  
    const panel = document.getElementById("settingsPanel");
    if (!panel.classList.contains("open")) return;          // 패널이 닫혀 있으면 무시

    const isMain = document.getElementById("panel-main").classList.contains("active");
    if (isMain) {                                           // 메인 메뉴일 때만
      document.getElementById("settingsToggle").click();    // 기존 토글 재사용
    } 

    // ───────── 아트월설정 모드일 때 (isArtwallMode) ─────────
    if (isArtwallMode) {
      pointerDownArtTime = Date.now();
      dragStartArt       = { x: e.clientX, y: e.clientY };
      isDraggingArt      = false;
      selectedArtwall    = null;

      // pointerdown에서 어떤 아트월 위에 있는지 감지해서 selectedArtwall 저장
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);
      // **현재 벽면의 아트월만 대상으로 Raycast!**
      const wallArts = artwalls.filter(mesh => detectWall(mesh) === currentWall);
      const hit = raycaster.intersectObjects(wallArts)[0];
      if (hit) selectedArtwall = hit.object;

      // 다른 아트월 편집 중이면 종료
      if (editingArtwall && editingArtwall !== selectedArtwall) {
        endEditingArtwall();
      }
      return; // 아트월 모드일 때는 여기서 끝
    } 

    if (!isPaintingMode) return;
    pointerDownTime = Date.now();
    dragStartScreen = { x: e.clientX, y: e.clientY };
    isDragging = false;
    selectedPainting = null;

    // pointerdown에서 어떤 그림 위에 있는지 감지해서 selectedPainting 저장
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(mouse, camera);
    const wallPaintings = paintings.filter(mesh => detectWall(mesh) === currentWall);
    const hits = raycaster.intersectObjects(wallPaintings);
    if (hits.length > 0) {
      selectedPainting = hits[0].object;
    }

    

  });

  renderer.domElement.addEventListener("pointerup", (e) => {

    if (isResizingWithHandle || isResizingPainting) return; // 크기조절 중이면 무시

    if (!isPaintingMode || !dragStartScreen) return;
    const dt = Date.now() - pointerDownTime;
    const dx = e.clientX - dragStartScreen.x;
    const dy = e.clientY - dragStartScreen.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    // --- 1. 드래그 상태 확인 ---
    if (isDragging) {
      wasDragging = true;
      // 드래그로 끝났을 때는 아무 동작도 하지 않는다 (버튼X)
    } else {
      wasDragging = false;
      // 클릭 판정(=드래그 아님 + 시간/거리 조건)
      if (dt < clickTimeThreshold && dist < dragThreshold && selectedPainting) {
        if (editingPainting && editingPainting !== selectedPainting) {
          endEditingPainting();
        }
        if (editingPainting !== selectedPainting) {
          startEditingPainting(selectedPainting);
        }
      }
      // 그림 없는 곳 클릭시
      if ((!selectedPainting || (dt < clickTimeThreshold && dist < dragThreshold && !selectedPainting))) {
        endEditingPainting();
      }
    }

    // 리셋
    dragStartScreen = null;
    pointerDownTime = 0;
    isDragging = false;
    selectedPainting = null;
  });

  renderer.domElement.addEventListener("pointermove", (e) => {

    if (isResizingWithHandle || isResizingPainting) return; // 크기조절 중이면 무시

    if (!isPaintingMode || !e.buttons & 1 || !dragStartScreen) return;

    const dx = e.clientX - dragStartScreen.x;
    const dy = e.clientY - dragStartScreen.y;
    if (!isDragging && Math.sqrt(dx*dx + dy*dy) > dragThreshold) {
      isDragging = true; // 일정 이상 움직이면 드래그 시작

      if (isEditingPainting) { // 드래그 시작 -> 기존 편집(테두리) 제거
      endEditingPainting();  // 테두리+편집버튼 모두 사라짐
      }
    }

    // 드래그 중이면 selectedPainting 이동
    if (isDragging && selectedPainting) {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(mouse, camera);

      const wallMesh = scene.getObjectByName(currentWall);
      if (wallMesh) {
        const intersects = raycaster.intersectObject(wallMesh);
        if (intersects.length > 0) {
          const point = intersects[0].point.clone();
          const normal = intersects[0].face.normal
            .clone()
            .transformDirection(wallMesh.matrixWorld);
          point.add(normal.multiplyScalar(0.05));

          const box = new THREE.Box3().setFromObject(selectedPainting);
          const size = new THREE.Vector3();
          box.getSize(size);

          const halfW = ROOM_WIDTH / 2;
          const halfH = ROOM_HEIGHT / 2;
          const halfD = ROOM_DEPTH / 2;

          const halfWidth = size.x / 2;
          const halfHeight = size.y / 2;
          const halfDepth = size.z / 2;

          switch (currentWall) {
            case "front":
            case "back":
              point.x = THREE.MathUtils.clamp(point.x, -halfW + halfWidth, halfW - halfWidth);
              point.y = THREE.MathUtils.clamp(point.y, -halfH + halfHeight, halfH - halfHeight);
              break;
            case "left":
            case "right":
              point.z = THREE.MathUtils.clamp(point.z, -halfD + halfDepth, halfD - halfDepth);
              point.y = THREE.MathUtils.clamp(point.y, -halfH + halfHeight, halfH - halfHeight);
              break;
          }

          selectedPainting.position.copy(point);
        }
      }
    }
  });

  renderer.domElement.addEventListener(
    "touchend",
    (event) => {
      if (event.touches && event.touches.length > 1) return // 멀티터치는 무시
      
      if (event.cancelable) event.preventDefault();  // cancelable 체크 추가
      // 터치 위치 → pointer 위치로 변환
      const touch = event.changedTouches[0]
      const rect = renderer.domElement.getBoundingClientRect()
      pointer.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1
      onClick(event)
    },
    { passive: false },
  )

  document.addEventListener("mousedown", function(e) {
    // 편집버튼만 예외, 그 외 나머지 클릭 시 무조건 편집 종료
    if (e.target.closest("#paintingEditButtons")) return;
    endEditingPainting();
  });

  renderer.domElement.addEventListener("mousemove", onPointerMove)
  window.addEventListener("resize", onWindowResize, false)

  // esc키로 편집 종료
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isEditingPainting) {
      endEditingPainting()
    }
  })

const dom = renderer.domElement;

// 1) pointerdown: 아트월 선택/편집 모드 진입
dom.addEventListener("pointerdown", e => {
  if (!isArtwallMode) return;
  pointerDownArtTime = Date.now();
  dragStartArt       = { x: e.clientX, y: e.clientY };
  isDraggingArt      = false;
  selectedArtwall    = null;

  // Raycast로 현재 벽면에서 클릭한 아트월 찾기
  const rect = dom.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top)  / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  const wallArts = artwalls.filter(m => detectWall(m) === currentWall);
  const hit = raycaster.intersectObjects(wallArts)[0];
  if (hit) selectedArtwall = hit.object;

  // 이미 다른 아트월 편집중이면 편집 종료
  if (editingArtwall && editingArtwall !== selectedArtwall) {
    endEditingArtwall();
  }
});

// 2) pointermove: 드래그로 이동
dom.addEventListener("pointermove", e => {
  if (!isArtwallMode || !(e.buttons & 1) || !dragStartArt) return;

  const dx = e.clientX - dragStartArt.x;
  const dy = e.clientY - dragStartArt.y;
  if (!isDraggingArt && Math.hypot(dx, dy) > dragThreshold) {
    isDraggingArt = true;
    endEditingArtwall();                 // 드래그 시작 → 편집 패널 숨김
  }
  if (!isDraggingArt || !selectedArtwall) return;

  // 벽면에서 마우스 위치에 따라 아트월 이동
  const rect = dom.getBoundingClientRect();
  const mouse = new THREE.Vector2(
    ((e.clientX - rect.left) / rect.width) * 2 - 1,
    -((e.clientY - rect.top)  / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(mouse, camera);
  const wallMesh = scene.getObjectByName(currentWall);
  const hit = wallMesh && raycaster.intersectObject(wallMesh)[0];
  if (!hit) return;

  const p = hit.point.clone();
  const n = hit.face.normal.clone().transformDirection(wallMesh.matrixWorld);
  p.add(n.multiplyScalar(0.05));         // 벽에서 살짝 띄우기

  // 벽 경계 내로 클램프
  const halfW = ROOM_WIDTH /2,  halfH = ROOM_HEIGHT/2, halfD = ROOM_DEPTH/2;
  const sBox  = new THREE.Box3().setFromObject(selectedArtwall);
  const size  = new THREE.Vector3(); sBox.getSize(size);
  const hw=size.x/2, hh=size.y/2, hd=size.z/2;

  switch (currentWall) {
    case "front": case "back":
      p.x = THREE.MathUtils.clamp(p.x, -halfW+hw, halfW-hw);
      p.y = THREE.MathUtils.clamp(p.y, -halfH+hh, halfH-hh);
      break;
    case "left": case "right":
      p.z = THREE.MathUtils.clamp(p.z, -halfD+hd, halfD-hd);
      p.y = THREE.MathUtils.clamp(p.y, -halfH+hh, halfH-hh);
      break;
  }
  selectedArtwall.position.copy(p);
});

// 3) pointerup: 클릭(편집) vs 드래그(이동) 판정
dom.addEventListener("pointerup", e => {
  if (!isArtwallMode || !dragStartArt) return;

  const dt   = Date.now() - pointerDownArtTime;
  const dist = Math.hypot(e.clientX-dragStartArt.x, e.clientY-dragStartArt.y);
  const clicked = dt < clickTimeThreshold && dist < dragThreshold;

  if (!isDraggingArt && clicked && selectedArtwall) {
    startEditingArtwall(selectedArtwall);   // 클릭시 편집 진입(삭제 버튼 생성)
  }
  if (!selectedArtwall || (clicked && !selectedArtwall)) {
    endEditingArtwall();
  }

  // 리셋
  dragStartArt = null;
  isDraggingArt = false;
  selectedArtwall = null;
});

  animate()
}

// 리사이즈 콜백 함수
function onWindowResize() {
  // 카메라 종횡비 업데이트
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // 렌더러 픽셀 비율·사이즈 업데이트
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function createRoom() {
  const textures = {
    floor: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor9.png",
    ),
    ceiling: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling4.png",
    ),
    front: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls2.png",
    ),
    back: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls2.png",
    ),
    left: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls2.png",
    ),
    right: textureLoader.load(
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls2.png",
    ),
  }

  textures.floor.wrapS = THREE.RepeatWrapping
  textures.floor.wrapT = THREE.RepeatWrapping
  textures.floor.repeat.set(5, 5)

  textures.ceiling.wrapS = THREE.RepeatWrapping
  textures.ceiling.wrapT = THREE.RepeatWrapping
  textures.ceiling.repeat.set(1, 1)
  ;["front", "back", "left", "right"].forEach((side) => {
    textures[side].wrapS = THREE.RepeatWrapping
    textures[side].wrapT = THREE.RepeatWrapping
    textures[side].repeat.set(2, 1)
  })

  const makeWall = (
    geometry,
    material,
    position,
    rotation,
    name,
    shouldFlipNormal = false,
  ) => {
    if (shouldFlipNormal) geometry.scale(-1, 1, 1)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.copy(position)
    mesh.rotation.copy(rotation)
    mesh.name = name // 이름설정
    scene.add(mesh)
    return mesh // 나중에 필요하면 mesh 반환 가능
  }

  makeWall(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH),
    new THREE.MeshStandardMaterial({ map: textures.floor }),
    new THREE.Vector3(0, -ROOM_HEIGHT / 2, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
    "floor",
  )
  makeWall(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_DEPTH),
    new THREE.MeshStandardMaterial({ map: textures.ceiling }),
    new THREE.Vector3(0, ROOM_HEIGHT / 2, 0),
    new THREE.Euler(-Math.PI / 2, 0, 0),
    "ceiling",
    true,
  )
  makeWall(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ map: textures.front }),
    new THREE.Vector3(0, PAINTING_Y_OFFSET, ROOM_DEPTH / 2),
    new THREE.Euler(0, 0, 0), // 회전은 그대로
    "front",
    true, // 법선 뒤집기
  )

  makeWall(
    new THREE.PlaneGeometry(ROOM_WIDTH, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ map: textures.back }),
    new THREE.Vector3(0, PAINTING_Y_OFFSET, -ROOM_DEPTH / 2),
    new THREE.Euler(0, 0, 0),
    "back",
  )

  makeWall(
    new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ map: textures.left }),
    new THREE.Vector3(ROOM_WIDTH / 2, PAINTING_Y_OFFSET, 0),
    new THREE.Euler(0, Math.PI / 2, 0),
    "left",
    true, // 실내를 보도록 뒤집기
  )

  makeWall(
    new THREE.PlaneGeometry(ROOM_DEPTH, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ map: textures.right }),
    new THREE.Vector3(-ROOM_WIDTH / 2, PAINTING_Y_OFFSET, 0),
    new THREE.Euler(0, Math.PI / 2, 0),
    "right",
  )
}

function addLights() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
  directionalLight.position.set(10, 20, 10)
  directionalLight.castShadow = true
  scene.add(directionalLight)
}

async function placePaintings() {
  const wallDefs = [
    {
      axis: "x",
      constVal: ROOM_DEPTH / 2 - WALL_OFFSET,
      width: ROOM_WIDTH,
      rotY: Math.PI,
      reverse: false,
    },
    {
      axis: "z",
      constVal: ROOM_WIDTH / 2 - WALL_OFFSET,
      width: ROOM_DEPTH,
      rotY: -Math.PI / 2,
      reverse: true,
    },
    {
      axis: "x",
      constVal: -ROOM_DEPTH / 2 + WALL_OFFSET,
      width: ROOM_WIDTH,
      rotY: 0,
      reverse: true,
    },
    {
      axis: "z",
      constVal: -ROOM_WIDTH / 2 + WALL_OFFSET,
      width: ROOM_DEPTH,
      rotY: Math.PI / 2,
      reverse: false,
    },
  ]

  const paintingsPerWall = Math.ceil(paintingsData.length / 4) // 유동적 계산
  let globalIndex = 0

  for (const wall of wallDefs) {
    const start = -wall.width / 2 + wall.width / (paintingsPerWall * 2)
    const spacing = wall.width / paintingsPerWall

    for (let i = 0; i < paintingsPerWall; i++) {
      if (globalIndex >= paintingsData.length) return // 남은 데이터 없으면 중단

      const pos = new THREE.Vector3()
      const localIndex = wall.reverse ? paintingsPerWall - 1 - i : i
      if (wall.axis === "x") {
        pos.x = start + localIndex * spacing
        pos.z = wall.constVal
      } else {
        pos.z = start + localIndex * spacing
        pos.x = wall.constVal
      }
      pos.y = PAINTING_Y_OFFSET

      const painting = await loadAndAddPainting(
        paintingsData[globalIndex],
        pos,
        wall.rotY,
      )
      globalIndex++
    }
  }
}

async function loadAndAddPainting(data, position, rotationY) {
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/GuatemalanGirl/mygallery/refs/heads/main/paintings/${data.filename}`
    textureLoader.load(
      url,
      (texture) => {
        const aspect = texture.image.width / texture.image.height
        let width = PAINTING_WIDTH_LIMIT
        let height = width / aspect
        if (height > PAINTING_HEIGHT_LIMIT) {
          height = PAINTING_HEIGHT_LIMIT
          width = height * aspect
        }

        const depth = 0.1 // 그림의 두께

        const geo = new THREE.BoxGeometry(width, height, depth)

        const materials = [
          new THREE.MeshStandardMaterial({ color: 0xffffff }), // 오른쪽
          new THREE.MeshStandardMaterial({ color: 0xffffff }), // 왼쪽
          new THREE.MeshStandardMaterial({ color: 0xffffff }), // 위
          new THREE.MeshStandardMaterial({ color: 0xffffff }), // 아래
          new THREE.MeshBasicMaterial({ map: texture }), // 앞 (그림)
          new THREE.MeshStandardMaterial({ color: 0xffffff }), // 뒤
        ]

        const mesh = new THREE.Mesh(geo, materials)
        mesh.position.copy(position)
        mesh.rotation.y = rotationY
        // 그림을 벽면으로 밀어주기
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
          mesh.quaternion,
        ) // foward는 정면 방향을 의미
        mesh.position.copy(position).add(forward.multiplyScalar(depth / 2)) // depth / 2 만큼 그 방향으로 이동시키면 그림의 뒷면이 벽에 붙음

        mesh.userData = { isPainting: true, data }
        mesh.userData.originalScale = mesh.scale.clone(); // 원래 크기 저장 (크기조절 핸들러)
        scene.add(mesh)
        paintings.push(mesh)
        resolve(mesh)
      },
      undefined,
      reject,
    )
  })
}

function showInfo() {
  if (currentPaintingIndex === -1) return
  const data = paintings[currentPaintingIndex].userData.data
  document.getElementById("infoContent").innerHTML =
    `<h2>${data.title}</h2><p>${data.description}</p>`
  document.getElementById("infoModal").style.display = "block"

  const mesh = paintings[currentPaintingIndex];
  updatePaintingInfo(mesh);

  // 작품선택모드일 때만 전역 클릭 차단 리스너 등록
  if (isPaintingMode) {
    document.addEventListener('mousedown', globalInputBlocker, true);
    document.addEventListener('touchstart', globalInputBlocker, true);
  }
}

function closeInfo() {
  document.getElementById("infoModal").style.display = "none";

  // 리스너 해제(작품선택모드일 때만)
  document.removeEventListener('mousedown', globalInputBlocker, true);
  document.removeEventListener('touchstart', globalInputBlocker, true);

  // 작품선택모드(또는 서문쓰기모드)일 때만 버튼 복원
  if ((isPaintingMode || isIntroMode) && selectedPainting) {
    showPaintingEditButtons(selectedPainting);
  } else {
  hidePaintingEditButtons();      // 관람 모드라면 버튼 숨김 유지
  // 또는 startEditingPainting(selectedPainting);
  }
}


function navigateLeft() {
  if (isCameraMoving || paintings.length === 0) return
  currentPaintingIndex = (currentPaintingIndex + 1) % paintings.length
  zoomTo(paintings[currentPaintingIndex], ZOOM_DISTANCE) // 첫 번째 줌 거리로 초기화
  zoomedPainting = paintings[currentPaintingIndex] // 줌인된 그림 업데이트
  zoomLevel = 1 // 줌 레벨 초기화
}

function navigateRight() {
  if (isCameraMoving || paintings.length === 0) return
  currentPaintingIndex =
    (currentPaintingIndex - 1 + paintings.length) % paintings.length
  zoomTo(paintings[currentPaintingIndex], ZOOM_DISTANCE) // 첫 번째 줌 거리로 초기화
  zoomedPainting = paintings[currentPaintingIndex] // 줌인된 그림 업데이트
  zoomLevel = 1 // 줌 레벨 초기화
}

document.getElementById("settingsToggle").addEventListener("click", () => {
  const panel = document.getElementById("settingsPanel")
  const gear = document.getElementById("settingsToggle")
  const isOpen = panel.classList.contains("open")
  const currentActive = document.querySelector(".settings-slide.active")
  const currentId = currentActive?.id

  if (isOpen) {
    if (currentId === 'panel-background' && !skipCancelBackground) {
      restoreTextureSet(); // ← 톱니로 닫을 때 롤백
    }

    if (currentId === "panel-paintings") {
      cancelPaintingChanges() // 작품선택 중이면 복원
      updateWallView() // 시점 복원 (카메라 고정 해제)
      controls.enabled = true // 마우스 조작 복원
      endEditingPainting() // 작품선택(배치)모드 종료
      isPaintingMode = false // 명시적으로 모드 비활성화
      document.getElementById("navButtons").classList.remove("slide-down"); // 하단 버튼
    }

    // ───────── panel-intro 롤백 ─────────
    if (currentId === "panel-intro" && !skipCancelIntro) {
      cancelIntroChanges(); // applyIntroButton이 눌리지 않았다면 롤백
      isIntroMode = false;
    }

    // ───────── panel-artwalls 롤백 (outline 정리 추가) ─────────
    if (currentId === "panel-artwalls") {
      endEditingArtwall();
    }
    
    // 슬라이드 상테를 메인으로 되돌린 뒤 패널 닫기
    showPanel("panel-main")
    panel.classList.remove("open")
    gear.classList.remove("moving")
  } else {
    if (document.getElementById("infoModal").style.display === "block") {
      closeInfo();
    }
    showPanel("panel-main") // 설정창 열 때 항상 메인 패널부터 시작
    panel.classList.add("open")
    gear.classList.add("moving")
  }
})

function zoomTo(painting, distance) {
  // distance 파라미터 추가
  if (!painting) return
  const target = painting.position.clone()
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
    painting.quaternion,
  )
  const newCamPos = target.clone().addScaledVector(forward, distance) // distance 적용
  newCamPos.y = PAINTING_Y_OFFSET

  let camTween = { ...camera.position }
  let lookTween = { ...controls.target }
  isCameraMoving = true
  controls.enabled = false

  new TWEEN.Tween(camTween)
    .to(newCamPos, CAMERA_DURATION)
    .easing(TWEEN.Easing.Cubic.InOut)
    .onUpdate(() => {
      camera.position.set(camTween.x, camTween.y, camTween.z)
    })
    .start()

  new TWEEN.Tween(lookTween)
    .to(target, CAMERA_DURATION)
    .easing(TWEEN.Easing.Cubic.InOut)
    .onUpdate(() => {
      controls.target.set(lookTween.x, lookTween.y, lookTween.z)
      controls.update()
    })
    .onComplete(() => {
      isCameraMoving = false
      controls.enabled = true
      isZoomedIn = true
      if (document.getElementById("infoModal").style.display === "block") {
        showInfo()
      }
    })
    .start()
}

function onClick(event) {
  if (isPaintingMode) return // 설정창 작품선택 시 클릭 차단
  if (isCameraMoving) return
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(paintings)
  if (hits.length > 0) {
    const mesh = hits[0].object

    if (zoomedPainting === mesh) {
      // 이미 선택된 그림 → 더블클릭에서 처리
      return
    } else {
      currentPaintingIndex = paintings.indexOf(mesh)
      zoomTo(mesh, ZOOM_DISTANCE) // 첫 번째 줌
      zoomedPainting = mesh
      zoomLevel = 1
    }
  } else {
    endEditingPainting(); // 그림이 아닌곳 클릭 시 편집 종료 -> 버튼 숨김
  }
}

function onDoubleClick(event) {
  if (isPaintingMode) return // 설정창 작품선택 시 클릭 차단
  if (!zoomedPainting || isCameraMoving) return;

  if (zoomLevel === 1) {
    zoomTo(zoomedPainting, ZOOM_DISTANCE_CLOSER); // 2차 줌
    zoomLevel = 2;
  } else if (zoomLevel === 2) {
    zoomTo(zoomedPainting, ZOOM_DISTANCE); // 다시 1차 줌으로
    zoomLevel = 1;
  }
}

function onPointerMove(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
  raycaster.setFromCamera(pointer, camera)
  const hits = raycaster.intersectObjects(paintings)
  const canvas = renderer.domElement
  if (
    isZoomedIn &&
    hits.length > 0 &&
    hits[0].object === paintings[currentPaintingIndex]
  ) {
    canvas.classList.add("grab")
    canvas.classList.remove("hovering")
  } else if (hits.length > 0) {
    canvas.classList.add("hovering")
    canvas.classList.remove("grab")
  } else {
    canvas.classList.remove("hovering", "grab")
  }
}

function hideInstructions() {
  document.getElementById("instructionOverlay").style.display = "none"
}

function showInstructions() {
  document.getElementById("instructionOverlay").style.display = "flex"
}

document.getElementById("instructionOverlay").addEventListener("click", () => {
  document.getElementById("instructionOverlay").style.display = "none"
})

function animate() {
  requestAnimationFrame(animate)
  TWEEN.update()

  // 카메라가 멀어지면 선택 해제
  if (zoomedPainting && !isCameraMoving) {
    const dist = camera.position.distanceTo(zoomedPainting.position)
    if (dist > ZOOM_DISTANCE + 1) {
      // 1 이상 멀어지면 사용자가 확실히 빠져나간 것으로 판단
      zoomedPainting = null
      zoomLevel = 0
      isZoomedIn = false
      currentPaintingIndex = -1
    }
  }

  //camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ROOM_WIDTH / 2 + 1, ROOM_WIDTH / 2 - 1);
  //camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.5, ROOM_HEIGHT - 1); // 바닥 밑이나 천장 뚫는 거 방지
  //camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ROOM_DEPTH / 2 + 1, ROOM_DEPTH / 2 - 1);

  if (!isPaintingMode) {
    controls.update()
  }

  // outlineLine이 있으면 따라가게(편집 중 위치이동시)
  if (outlineLine && editingPainting) {
    outlineLine.position.copy(editingPainting.position);
    outlineLine.quaternion.copy(editingPainting.quaternion);
  }

  renderer.render(scene, camera)
}

let exhibitInfo = {
  title: "",
  startDate: null,
  endDate: null,
}

function setupExhibitSettings() {
  const titleInput = document.getElementById("exhibitTitle")
  const startInput = document.getElementById("exhibitStart")
  const endInput = document.getElementById("exhibitEnd")
  const saveBtn = document.getElementById("saveExhibitButton")

  if (!titleInput || !startInput || !endInput || !saveBtn) return

  // 기존 저장값 로딩
  const saved = localStorage.getItem("exhibitInfo")
  if (saved) {
    const parsed = JSON.parse(saved)
    exhibitInfo = parsed
    titleInput.value = parsed.title || ""
    startInput.value = parsed.startDate || ""
    endInput.value = parsed.endDate || ""
  }

  // 저장 버튼 클릭 시 저장
  document.getElementById("saveExhibitButton").addEventListener("click", () => {
    exhibitInfo.title = titleInput.value
    exhibitInfo.startDate = startInput.value
    exhibitInfo.endDate = endInput.value

    localStorage.setItem("exhibitInfo", JSON.stringify(exhibitInfo))
    updateGalleryInfo() // 저장버튼 클릭하면 갤러리 정보도 업데이트

    alert("테마설정이 적용되었습니다!")
  })
  updateGalleryInfo() // setupExhibitSettings 끝날 때도 초기 갤러리 정보 업데이트

  // ****************개발 모드****************
  const isDevMode = true // 출시할 때는 반드시 false로 바꾸기!!!!!!!!!!!!!!
}

function checkExhibitPeriod() {
  //if (isDevMode) return; // 개발 중이면 체크 스킵 ************** --> '//' 해제하기

  if (!exhibitInfo.endDate) return

  const today = new Date()
  const end = new Date(exhibitInfo.endDate)

  if (today > end) {
    document.body.innerHTML = `
      <div style="text-align:center; margin-top:50px;">
        <h1>전시가 종료되었습니다</h1>
        <button id="resetExhibitButton" style="
          margin-top:20px; padding:10px 20px;
          background-color:#ff6666; color:white;
          font-size:18px; border:none; border-radius:20px;
          cursor:pointer;
        ">
          X
        </button>
      </div>
    `

    // 초기화 버튼 기능 연결
    document
      .getElementById("resetExhibitButton")
      .addEventListener("click", () => {
        localStorage.removeItem("exhibitInfo")
        alert("전시 설정이 초기화되었습니다! 새로고침됩니다.")
        location.reload() // 새로고침
      })
  }
}

function updateGalleryInfo() {
  const infoDiv = document.getElementById("galleryInfo")
  if (!infoDiv) return

  const { title, startDate, endDate } = exhibitInfo

  if (title || (startDate && endDate)) {
    infoDiv.innerHTML = `
      <div class="title">${title || "전시명 없음"}</div>
      <div class="period">${startDate || "?"} ~ ${endDate || "?"}</div>
    `
  } else {
    infoDiv.innerHTML = ""
  }
}

const textureSets = {
  set1: {
    floor:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor1.png",
    ceiling:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling1.png",
    walls:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls1.png",
  },
  set2: {
    floor:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor2.png",
    ceiling:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling2.png",
    walls:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls2.png",
  },
  set3: {
    floor:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor3.png",
    ceiling:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling3.png",
    walls:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls3.png",
  },
  set4: {
    floor:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor4.png",
    ceiling:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling4.png",
    walls:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls4.png",
  },
  set5: {
    floor:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor5.png",
    ceiling:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling5.png",
    walls:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls5.png",
  },
  set6: {
    floor:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor6.png",
    ceiling:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling6.png",
    walls:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls6.png",
  },
  set7: {
    floor:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor7.jpg",
    ceiling:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling7.png",
    walls:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls8.png",
  },
  set8: {
    floor:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/floor/floor8.png",
    ceiling:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/ceiling/ceiling8.png",
    walls:
      "https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/textures/walls/walls9.png",
  },
}

let selectedTextureSet = null // 사용자가 선택한 (미리보기용)
let confirmedTextureSet = null // 마지막으로 저장된 값

document.querySelectorAll(".texture-option").forEach((option) => {
  option.addEventListener("click", () => {
    const setName = option.getAttribute("data-set")
    selectedTextureSet = setName
    applyPreviewTextureSet(setName) // 선택된 썸네일 배경 즉시 미리보기
    highlightSelectedOption(option) // 선택된 썸네일 시각적으로 표시
  })
})

function applyPreviewTextureSet(setName) {
  const set = textureSets[setName]
  if (!set) return

  const floor = textureLoader.load(set.floor)
  const ceiling = textureLoader.load(set.ceiling)
  const walls = textureLoader.load(set.walls)
  updateRoomTextures(floor, ceiling, walls) // 즉시 반영
}

function applyTextureSet(setName) {
  confirmedTextureSet = setName // 진짜 확정
  selectedTextureSet = setName
  localStorage.setItem("selectedTextureSet", setName)
  applyPreviewTextureSet(setName)
}

function restoreTextureSet() {
  if (!confirmedTextureSet || !scene) return
  applyPreviewTextureSet(confirmedTextureSet)
  selectedTextureSet = confirmedTextureSet
}

function updateRoomTextures(floorTex, ceilingTex, wallTex) {
  const floor = scene.getObjectByName("floor")
  const ceiling = scene.getObjectByName("ceiling")
  const back = scene.getObjectByName("back")
  const front = scene.getObjectByName("front")
  const left = scene.getObjectByName("left")
  const right = scene.getObjectByName("right")

  if (floor) floor.material.map = floorTex
  if (ceiling) ceiling.material.map = ceilingTex
  if (back) back.material.map = wallTex
  if (front) front.material.map = wallTex
  if (left) left.material.map = wallTex
  if (right)
    right.material.map = wallTex

    // 중요! 텍스처 바꿨으면 업데이트 필요
  ;[floor, ceiling, back, front, left, right].forEach((mesh) => {
    if (mesh) mesh.material.needsUpdate = true
  })
}

function initApp() {
  // 먼저 저장된 texture set을 미리 기억해둠
  const savedTextureSet = localStorage.getItem("selectedTextureSet")
  if (savedTextureSet) {
    confirmedTextureSet = savedTextureSet
    selectedTextureSet = savedTextureSet
  }

  // ✅ paintingsData를 외부에서 불러오고, 이후 init 실행
  fetch("https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/paintings/metadata.json")
    .then((res) => res.json())
    .then((data) => {
      paintingsData = data;

      // Three.js 초기화 (async 버전으로)
      init().then(() => {
        // scene, walls 다 준비된 후 텍스처 적용
        if (confirmedTextureSet) {
          applyPreviewTextureSet(confirmedTextureSet)
        }

        // 이 시점에 나머지 UI 설정 시작
        setupExhibitSettings()
        checkExhibitPeriod()
        updateGalleryInfo()

        // ───── 핸들러 드래그 이벤트 바인딩 ─────
        const canvas = renderer.domElement;
        canvas.addEventListener('pointerdown', onResizeHandlePointerDown);
        canvas.addEventListener('pointermove', onResizeHandlePointerMove);
        canvas.addEventListener('pointerup',   onResizeHandlePointerUp);

      });
    })
    .catch((err) => {
      alert("그림 정보를 불러오는 데 실패했습니다!");
      console.error(err);
    });
}

function highlightSelectedOption(selected) {
  document.querySelectorAll(".texture-option").forEach((opt) => {
    opt.style.border = "2px solid transparent"
  })
  selected.style.border = "2px solid #ff8b79" // 선택된 것 강조
}

document
  .getElementById("applyBackgroundButton")
  .addEventListener("click", () => {
    if (!selectedTextureSet) {
      alert("배경을 선택하세요!")
      return
    }

    applyTextureSet(selectedTextureSet)
    alert("배경이 적용되었습니다!")
    skipCancelBackground = true; // 롤백 스킵
    showPanel('panel-main'); // 메인으로 복귀
    skipCancelBackground = false; // 플래그 초기화

    localStorage.setItem("selectedTextureSet", selectedTextureSet)
  })

// (1) '적용' 버튼 클릭 핸들러를 분리한 named function
function handleApplyPaintings() {
  isPaintingMode = false;
  controls.enabled = true;

  originalPaintings = [...paintings];
  originalPaintingsState = paintings.map(mesh => ({
    mesh,
    position: mesh.position.clone(),
    rotation: mesh.rotation.clone(),
    scale: mesh.scale.clone()
  }));
  tempPaintings = [];

  updatePaintingOrderByPosition();
  hidePaintingEditButtons();

  skipCancelPainting = true;
  showPanel("panel-main");
  skipCancelPainting = false;
}

// (2) populatePaintingGrid: 썸네일 그리드 생성 + 이벤트 등록
function populatePaintingGrid() {
  const grid = document.getElementById("paintingGrid")
  if (!grid) return

  grid.innerHTML = "" // 기존 내용 초기화

  const start = currentPage * itemsPerPage ;
  const end = start + itemsPerPage ;
  const currentItems = paintingsData.slice(start, end);

  currentItems.forEach((painting, index) => {
    const globalIndex = start + index; // globalIndex 계산

    const thumb = document.createElement("img")
    thumb.src = `https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/paintings/${painting.filename}`
    thumb.alt = painting.title
    thumb.draggable = true
    thumb.dataset.index = globalIndex; // 전체 인덱스 기준
    thumb.classList.add("thumbnail")

    // 드래그 시작
    thumb.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("painting", JSON.stringify(painting)); // 객체 전체 전달
    })

    grid.appendChild(thumb);
  });

  // 4) '적용' 버튼 이벤트: 반복문 밖에서 한 번만 등록
  const applyBtn = document.getElementById("applyPaintingsButton");
  applyBtn.removeEventListener("click", handleApplyPaintings);
  applyBtn.addEventListener   ("click", handleApplyPaintings);

  // 5) 페이징 버튼 상태 업데이트
  updatePageButtons();
}

document.getElementById("prevPageBtn").addEventListener("click", () => {
  if (currentPage > 0) {
    currentPage--;
    populatePaintingGrid();
  }
});

document.getElementById("nextPageBtn").addEventListener("click", () => {
  const maxPage = Math.floor((paintingsData.length - 1) / itemsPerPage);
  if (currentPage < maxPage) {
    currentPage++;
    populatePaintingGrid();
  }
});

function updatePageButtons() {
  const prev = document.getElementById("prevPageBtn");
  const next = document.getElementById("nextPageBtn");
  const maxPage = Math.floor((paintingsData.length - 1) / itemsPerPage);

  prev.disabled = currentPage === 0;
  next.disabled = currentPage >= maxPage;
}

// 현재 선택된 벽 이름들
let currentWall = "front" // 초기값
const wallNames = ["front", "right", "back", "left"]

// 1) 모든 .current-wall-label 텍스트를 한 번에 갱신
function updateAllWallLabels() {
  const labelText = currentWall.charAt(0).toUpperCase() + currentWall.slice(1);
  document.querySelectorAll(".current-wall-label")
          .forEach(label => label.textContent = labelText);
}

// 2) 좌/우 네비 버튼에 클릭 리스너 등록
function addWallNavListeners() {
  document.querySelectorAll(".wall-left-btn")
          .forEach(btn => btn.addEventListener("click", () => {
            const idx = wallNames.indexOf(currentWall);
            currentWall = wallNames[(idx - 1 + wallNames.length) % wallNames.length];
            updateWallView();
          }));

  document.querySelectorAll(".wall-right-btn")
          .forEach(btn => btn.addEventListener("click", () => {
            const idx = wallNames.indexOf(currentWall);
            currentWall = wallNames[(idx + 1) % wallNames.length];
            updateWallView();
          }));
}

// 3) 카메라와 레이블을 함께 갱신
function updateWallView() {
  // 레이블 먼저
  updateAllWallLabels();

  // 카메라 시점 고정
  const pos = new THREE.Vector3()
  const look = new THREE.Vector3(0, PAINTING_Y_OFFSET, 0)

  switch (currentWall) {
    case "front":
      pos.set(0, PAINTING_Y_OFFSET, -ROOM_DEPTH * 0.1)
      break
    case "right":
      pos.set(ROOM_WIDTH * 0.1, PAINTING_Y_OFFSET, 0)
      break
    case "back":
      pos.set(0, PAINTING_Y_OFFSET, ROOM_DEPTH * 0.1)
      break
    case "left":
      pos.set(-ROOM_WIDTH * 0.1, PAINTING_Y_OFFSET, 0)
      break
  }

  new TWEEN.Tween(camera.position)
    .to(pos, 600)
    .easing(TWEEN.Easing.Cubic.InOut)
    .onUpdate(() => {
      camera.lookAt(controls.target)
    })
    .start()

  new TWEEN.Tween(controls.target)
    .to(look, 600)
    .easing(TWEEN.Easing.Cubic.InOut)
    .onUpdate(() => {
      controls.update()
      camera.lookAt(controls.target)
    })
    .start()
}

// 4) 초기화: DOM 로드 후 한 번만 실행
window.addEventListener("DOMContentLoaded", () => {
  updateAllWallLabels();  // 처음 레이블 세팅
  addWallNavListeners();  // 버튼 리스너 등록

  // 전시서문 프레임 썸네일 dragstart
  const frameThumb = document.getElementById("introFrameThumb");
  if (frameThumb) {
    frameThumb.addEventListener("dragstart", (e) => {
      // 전역 변수에 타입 저장
      draggedIntroType = "frame";
      // drop 시 식별용 데이터도 전송
      e.dataTransfer.setData("text/plain", "frame");
    });
  }

  // 전시서문 플레인 썸네일 dragstart
  const planeThumb = document.getElementById("introPlaneThumb");
  if (planeThumb) {
    planeThumb.addEventListener("dragstart", (e) => {
      draggedIntroType = "plane";
      e.dataTransfer.setData("text/plain", "plane");
    });
  }

  const applyIntroBtn = document.getElementById("applyIntroButton");
  if (applyIntroBtn) {
    applyIntroBtn.addEventListener("click", () => {
      // 전시서문쓰기 모드에서만 롤백 방지 플래그 사용
      skipCancelIntro = true;
      safeUpdatePaintingOrder(); // intro 확정 후 정렬
      // 패널 닫고 메인으로 복귀
      showPanel("panel-main");
      // 플래그 리셋
      skipCancelIntro = false;
    });
  }
});

function cancelPaintingChanges() {
  for (let mesh of tempPaintings) {
    scene.remove(mesh)
    paintings.splice(paintings.indexOf(mesh), 1) // paintings에서도 제거
  }
  tempPaintings = []

  // 기존 그림 위치 복원
  originalPaintingsState.forEach(({ mesh, position, rotation, scale, story }) => {
    mesh.position.copy(position)
    mesh.rotation.copy(rotation)
    if (scale) {mesh.scale.copy(scale);
    } else if (mesh.userData.originalScale) {
      mesh.scale.copy(mesh.userData.originalScale); // 크기 조절 복원
    }
    // ――― 작품 이야기 롤백 ―――
    mesh.userData.story = story;
    if (mesh.userData.data) {
      mesh.userData.data.description = story;
    }
  })
}

// 편집 시작/종료 함수
function startEditingPainting(mesh) {
  editingPainting = mesh
  isEditingPainting = true
  showPaintingEditButtons(mesh); // 그림 클릭 시 버튼 표시
  showOutline(mesh); // 테두리 효과 추가
}

function showPaintingEditButtons(mesh) {
  // 현재 모드(작품선택/서문쓰기)를 구분
  // isPaintingMode, isIntroMode 등 상태 변수는 패널 전환 함수 등에서 반드시 관리!
  // mesh.userData.type === 'intro-frame' 또는 'intro-plane'이면 서문

  // 버튼 영역 비우기
  editingButtonsDiv.innerHTML = '';

  // 크기조절 버튼
  const resizeBtn = document.createElement('button');
  resizeBtn.innerText = '크기조절';
  // ★여기에 핸들러 모드 진입 트리거 추가★
  resizeBtn.onclick = () => {
    // 기존 버튼 기반 모드는 그대로 두되, 핸들러 모드도 초기화
    showResizeSizeButtons(mesh);
    createResizeHandle(mesh);
  };
  editingButtonsDiv.appendChild(resizeBtn);

  // 삭제 버튼
  const deleteBtn = document.createElement('button');
  deleteBtn.innerText = '삭제';
  deleteBtn.onclick = () => deletePainting(mesh);
  editingButtonsDiv.appendChild(deleteBtn);

  // 작품선택모드에서 "작품이야기" 버튼 추가
  if (mesh.userData.isPainting && !mesh.userData.type?.startsWith("intro")) {
    const storyBtn = document.createElement('button');
    storyBtn.innerText = '작품이야기';
    storyBtn.onclick = () => showPaintingStoryEditor(mesh);
    editingButtonsDiv.appendChild(storyBtn);
  }

  // 프레임서문(intro-frame)이면서, 전시서문쓰기 모드일 때만 "프레임색상" 버튼 추가
  if (mesh.userData.type === 'intro-frame' && isIntroMode) {  
    const colorBtn = document.createElement('button');
    colorBtn.innerText = '프레임색상';
    colorBtn.onclick = () => showFrameColorPicker(mesh);
    editingButtonsDiv.appendChild(colorBtn);
  }

  // 서문 + 서문쓰기모드라면 텍스트입력 버튼도 추가
  const isIntro = mesh.userData.type === 'intro-frame' || mesh.userData.type === 'intro-plane';
  if (isIntro && isIntroMode) {
    const editTextBtn = document.createElement('button');
    editTextBtn.innerText = '텍스트입력';
    editTextBtn.onclick = () => focusIntroWithEditor(mesh); // 아래 별도 정의
    editingButtonsDiv.appendChild(editTextBtn);
  }

  // 버튼 영역 보여주기
  editingButtonsDiv.style.display = 'block';
}

function endEditingPainting() {
  if (editingPainting) {
    removeOutline(); // 테두리 효과 제거
  }

  if (isResizingPainting && editingPainting) {
    // 크기조절 도중 확인을 안 누르고 종료할 때는
    // scale을 원래 값(저장된 값)으로 복원
    const orig = editingPainting.userData.originalScale;
    const scaleValue = editingPainting.userData.scaleValue || 1;
    editingPainting.scale.set(
      orig.x * scaleValue,
      orig.y * scaleValue,
      orig.z
    );
    // outline도 복구
    showOutline(editingPainting);
    isResizingPainting = false;
  }

  editingPainting = null
  isEditingPainting = false
  dragging = false // 명시적 초기화
  hidePaintingEditButtons(); // 편집종료 시 버튼 숨김

  // === Quill 오버레이도 항상 닫기! ===
  if (typeof introTextEditorOverlay !== 'undefined') {
    introTextEditorOverlay.style.display = 'none';
    editingIntroMesh = null;
  }  
}

// 편집툴 숨기기 함수
function hidePaintingEditButtons() {
  editingButtonsDiv.style.display = 'none';
}

function showResizeSizeButtons(mesh) {
  isResizingPainting = true;

  // 5가지 고정 배율값
  const scaleList = [
    {label: "6호", value: 0.5},
    {label: "12호", value: 0.67},
    {label: "25호", value: 1},
    {label: "50호", value: 1.5},
    {label: "100호", value: 2}
  ];

  // mesh의 원본스케일을 userData에 보관 (최초 진입시에만)
  if (!mesh.userData.originalScale) {
    mesh.userData.originalScale = mesh.scale.clone();
  }
  // 현재 배율 값도 없으면 1로
  if (mesh.userData.scaleValue === undefined) {
    mesh.userData.scaleValue = 1;
  }

  const orig = mesh.userData.originalScale;
  let currentScaleValue = mesh.scale.x / orig.x;

  // "작품(그림)이면서 intro 아님"일 때만 크기버튼 생성
  const isArtwork = mesh.userData.isPainting && !mesh.userData.type?.startsWith('intro');
  let html = "";

  if (isArtwork && isPaintingMode) {
    html += `
      <div style="display:flex;gap:8px;justify-content:center;">
        ${scaleList.map(s =>
          `<button class="scale-btn" data-scale="${s.value}" ${s.value===currentScaleValue?'style="background:#c7eaff;"':''}>${s.label}</button>`
        ).join("")}
      </div>
    `;
  }

  html += `
    <button id="resizeOkBtn">확인</button>
    <button id="resizeCancelBtn">취소</button>
  `;

  editingButtonsDiv.innerHTML = html;

  // 크기버튼이 존재할 때만 (작품일 때만)
  if (isArtwork && isPaintingMode) {
    // 버튼 생성 후, 진입 시 현재 배율 버튼만 하이라이트!
    const btns = document.querySelectorAll('.scale-btn');
    btns.forEach(btn => {
      if (parseFloat(btn.getAttribute('data-scale')) === currentScaleValue) {
        btn.style.background = "#ffffff";
      } else {
        btn.style.background = "";
      }
    });

    mesh.userData.tempScaleValue = currentScaleValue; // 임시 선택값

    // 각 배율 버튼 클릭시
    document.querySelectorAll('.scale-btn').forEach(btn => {
      btn.onclick = () => {
        mesh.userData.tempScaleValue = parseFloat(btn.getAttribute('data-scale'));
        // 원본스케일 x 선택배율
        const orig = mesh.userData.originalScale;
        mesh.scale.set(
          orig.x * mesh.userData.tempScaleValue,
          orig.y * mesh.userData.tempScaleValue,
          orig.z
        );

        updateIntroTextScale(mesh);

        // 버튼 하이라이트 효과
        document.querySelectorAll('.scale-btn').forEach(b=>b.style.background="");
        btn.style.background = "#ffffff";
        // outline도 배율 바뀔 때마다 갱신
        createResizeHandle(mesh);
        showOutline(mesh);
      };
    });
  }
  // 확인 버튼
  document.getElementById("resizeOkBtn").onclick = () => {
    // mesh에 최종값 저장
    mesh.userData.scaleValue = mesh.userData.tempScaleValue;

    // outline 크기 갱신
    if (isEditingPainting && editingPainting === mesh) {
      showOutline(mesh); // 테두리 다시 만듦
    }

    updateIntroTextScale(mesh);
    
    // 크기조절 시 텍스트 크기도 비율에 맞게 갱신
    if (mesh.userData.text) {
      updateIntroTextPlaneFromHTML(mesh, mesh.userData.html);
    } else if (mesh.userData.text) {
      updateIntroTextPlane(mesh, mesh.userData.text, {
        fontFamily: mesh.userData.fontFamily,
        fontSize: mesh.userData.fontSize,
        color: mesh.userData.fontColor
      });
    }
    // 이미 scale 적용됨
    isResizingPainting = false;

    if (resizeHandleMesh) {
      scene.remove(resizeHandleMesh);
      resizeHandleMesh = null;
    } // 핸들 제거
    
    showPaintingEditButtons(mesh);
  };

  // 취소 버튼
  document.getElementById("resizeCancelBtn").onclick = () => {
    // 원래 크기로 복귀
    const orig = mesh.userData.originalScale;
    mesh.scale.set(
      orig.x * currentScaleValue,
      orig.y * currentScaleValue,
      orig.z
    );
    // outline도 복구!
    showOutline(mesh);

    isResizingPainting = false;

    if (resizeHandleMesh) {
      scene.remove(resizeHandleMesh);
      resizeHandleMesh = null;
    } // 핸들 제거

    showPaintingEditButtons(mesh);
  };
}

function deletePainting(mesh) {
  scene.remove(mesh);
  const idx = paintings.indexOf(mesh);
  if (idx !== -1) paintings.splice(idx, 1);
  endEditingPainting();
  hidePaintingEditButtons();
}

function updatePaintingOrderByPosition() {
  const wallOrder = ["front", "left", "back", "right"] // 반대로 돌아서 left, right 순서 변경
  const wallSortingFns = {
    front: (a, b) => a.position.x - b.position.x,
    back: (a, b) => b.position.x - a.position.x,
    left: (a, b) => b.position.z - a.position.z,
    right: (a, b) => a.position.z - b.position.z,
  }

  paintings.sort((a, b) => {
    const aWall = detectWall(a)
    const bWall = detectWall(b)

    const aIdx = wallOrder.indexOf(aWall)
    const bIdx = wallOrder.indexOf(bWall)

    if (aIdx !== bIdx) return aIdx - bIdx

    // 같은 벽에 있으면 좌우 순서대로 정렬
    return wallSortingFns[aWall]?.(a, b) || 0
  })
}

function detectWall(mesh) {
  const z = mesh.position.z
  const x = mesh.position.x
  const eps = 0.2 // 오차 허용

  if (Math.abs(z - ROOM_DEPTH / 2) < eps) return "front"
  if (Math.abs(z + ROOM_DEPTH / 2) < eps) return "back"
  if (Math.abs(x - ROOM_WIDTH / 2) < eps) return "left"
  if (Math.abs(x + ROOM_WIDTH / 2) < eps) return "right"
  return "unknown"
}

function showOutline(mesh) {
  removeOutline(); // 기존 outline 제거(중복방지)

  // mesh geometry보다 약간 크게
  const scale = 1.06;
  const geo = mesh.geometry.clone();
  geo.scale(scale, scale, scale);

  const edges = new THREE.EdgesGeometry(geo);
  const outlineMat = new THREE.LineBasicMaterial({
    color: 0x3399ff, // 파란색
    linewidth: 2 // 크롬에서는 1만 지원됨(두께 바꾸고 싶으면 scale로!)
  });

  outlineLine = new THREE.LineSegments(edges, outlineMat);
  outlineLine.scale.copy(mesh.scale);
  outlineLine.position.copy(mesh.position);
  outlineLine.quaternion.copy(mesh.quaternion);
  outlineLine.renderOrder = 999; // 항상 위에 그리기

  scene.add(outlineLine);
}

function removeOutline() {
  if (outlineLine) {
    scene.remove(outlineLine);
    outlineLine.geometry.dispose();
    outlineLine.material.dispose();
    outlineLine = null;
  }
}

document.getElementById("introFrameThumb").addEventListener("dragstart", (e) => {
  draggedIntroType = "frame";
});
document.getElementById("introPlaneThumb").addEventListener("dragstart", (e) => {
  draggedIntroType = "plane";
});

function createIntroFrameBoxAt(position, currentWall) {
  const boxWidth = 3, boxHeight = 3, boxDepth = 0.1; // 작품과 두께 동일
  const geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
  const materials = [
    new THREE.MeshStandardMaterial({ color: 0xffffff }), // 오른쪽
          new THREE.MeshStandardMaterial({ color: 0xffffff }), // 왼쪽
          new THREE.MeshStandardMaterial({ color: 0xffffff }), // 위
          new THREE.MeshStandardMaterial({ color: 0xffffff }), // 아래
          new THREE.MeshBasicMaterial({ color: 0xffffff }), // 앞 (그림)
          new THREE.MeshStandardMaterial({ color: 0xffffff }), // 뒤
  ];
  const box = new THREE.Mesh(geometry, materials);
  box.position.copy(position);

  let pos = position.clone();
  let rotY = getWallRotationY(currentWall);
  box.position.copy(pos);
  box.rotation.y = rotY;
  // 작품처럼 정면 방향으로 밀기
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(box.quaternion);
  box.position.add(forward.multiplyScalar(boxDepth / 2));

  box.userData = {
    isPainting : true,          // ← 탐색·줌 대상
    type       : "intro-frame",
    /*data : {                    // infoModal 기본 데이터
      title       : "전시 서문",
      description : "(내용 없음)"
    }*/
  };
  
  box.userData._baseScale = box.scale.clone(); // 처음 1,1,1 저장
  box.userData.textMesh = null; // 텍스트 메쉬를 나중에 연결할 수 있도록 기본값 null

  // 이전에 저장된 색상이 있으면 앞면 색 반영
  if (box.userData.frameColor) {
    box.material[4].color.set(box.userData.frameColor);
  }

  scene.add(box);
  paintings.push(box);
  if (isIntroMode) tempIntroMeshes.push(box);
  safeUpdatePaintingOrder();
  return box;
}

function createIntroWallPlaneAt(position, currentWall) {
  const planeWidth = 3, planeHeight = 3;
  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
  const material = new THREE.MeshBasicMaterial({
    color: 0xcde0ff,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide
  });
  const plane = new THREE.Mesh(geometry, material);

  // 1. 위치 지정 (point는 이미 벽 앞)
  plane.position.copy(position);

  // 2. 회전 (작품 드롭과 완전히 동일하게)
  let rotY = getWallRotationY(currentWall); // 아래에서 함수도 참고
  plane.rotation.y = rotY;

  // 3. 벽 정면 방향으로 plane의 두께(혹은 offset)만큼 더 빼기
  // 여기서 offset을 "아트월"보다 더 크게!
  const artwallOffset = 0.05;      // 아트월이 사용하는 offset 예시
  const introPlaneOffset = 0.08;   // 벽면서문은 0.08로 더 앞쪽!
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(plane.quaternion);
  plane.position.add(forward.multiplyScalar(introPlaneOffset));

  // 4. 항상 아트월보다 위에 나오도록 renderOrder 적용
  plane.renderOrder = 10; // 아트월이 1~2면 이건 10 등 더 큰 값

  plane.userData = {
    isPainting : true,          // ← 탐색 대상
    type       : "intro-plane",
    /*data : {                    // infoModal용 최소 데이터
      title       : "전시 서문",
      description : "(내용 없음)"
    }*/
  };

  plane.userData._baseScale = plane.scale.clone();
  plane.userData.textMesh = null;

  scene.add(plane);
  if (isIntroMode) tempIntroMeshes.push(plane);
  paintings.push(plane);
  safeUpdatePaintingOrder();
  return plane;
}
  
function getWallRotationY(currentWall) {
  switch (currentWall) {
    case "front": return Math.PI;
    case "back":  return 0;
    case "left":  return -Math.PI/2;
    case "right": return Math.PI/2;
    default:      return 0;
  }
}

// ---- Quill 기반 텍스트 입력 오버레이 ----

// Quill 에디터 준비(최초 1번)

function setupQuillEditor() {
  if (!quill) {
    quill = new Quill('#quillEditor', {
      modules: {
        toolbar: [
          [{ 'font': [] }, { 'size': [] }],
          ['bold', 'italic', 'underline', { 'color': [] }],
          [{ 'align': [] }]
        ]
      },
      theme: 'snow'
    });
  }
}

// 텍스트 입력 오버레이 열기 -> mesh 표면의 중앙 지점을 2D 화면 좌표로 투영하는 방식
function showOverlayEditor(mesh) {
  hidePaintingEditButtons();
  setEditorOverlayToPlane(mesh);

  // 새 편집 대상으로 업데이트
  editingIntroMesh = mesh;
  setupQuillEditor();

  /** 1. 먼저 모든 text-change 리스너 제거 */
  quill.off('text-change');

  /** 2. 콘텐츠 로드/초기화 (silent 옵션으로 이벤트 방지) */
  if (mesh.userData.html && mesh.userData.html.trim() !== "") {
    // 기존 글이 있으면 붙여 넣기
    quill.clipboard.dangerouslyPasteHTML(mesh.userData.html, 'silent');
    editingIntroHTML = mesh.userData.html;
  } else {
    // 빈 글로 초기화
    quill.setText('', 'silent');
    editingIntroHTML = '';
  }

  /** 3. 새 리스너 등록 */
  quill.on('text-change', function() {
    editingIntroHTML = quill.root.innerHTML; // 임시 변수에만 저장
    updateIntroTextPlaneFromHTML(mesh, editingIntroHTML); // 미리보기
  })

  // 편집 모드 진입시 즉시 미리보기
  updateIntroTextPlaneFromHTML(mesh, quill.root.innerHTML);

  // 3D→2D 변환으로 화면에 띄울 위치 계산
  let worldPos;
  if (mesh.geometry.parameters && mesh.geometry.parameters.depth !== undefined) {
    worldPos = mesh.localToWorld(
      new THREE.Vector3(0, 0, mesh.geometry.parameters.depth / 2 + 0.02)
    );
  } else {
    worldPos = mesh.localToWorld(new THREE.Vector3(0, 0, 0.03));
  }
  worldPos.project(camera);
  const sx = worldPos.x * window.innerWidth / 2 + window.innerWidth / 2;
  const sy = -worldPos.y * window.innerHeight / 2 + window.innerHeight / 2;

  // 오버레이 띄우기
  introTextEditorOverlay.style.display = 'block';
  introTextEditorOverlay.style.left = (sx - 180) + 'px';  // 에디터 너비의 절반
  introTextEditorOverlay.style.top = (sy - 70) + 'px';    // 에디터 높이의 절반
}

// --- 적용/확인 버튼 이벤트 ---
introTextApplyBtn.onclick = function() {
  if (editingIntroMesh) {
    // Quill에서 HTML을 가져와 userData에 저장
    editingIntroMesh.userData.html = quill.root.innerHTML;
    updateIntroTextPlaneFromHTML(editingIntroMesh, quill.root.innerHTML);
  }
  introTextEditorOverlay.style.display = 'none';
  zoomBackOut();
  showPaintingEditButtons(editingIntroMesh); // 편집 메뉴 복원
  editingIntroMesh = null;
};

// --- 취소 버튼 이벤트 ---
introTextCancelBtn.onclick = function() {
  if (editingIntroMesh) {
    updateIntroTextPlaneFromHTML(editingIntroMesh, editingIntroMesh.userData.html || "");
  }
  introTextEditorOverlay.style.display = 'none';
  zoomBackOut();
  showPaintingEditButtons(editingIntroMesh); // 편집 메뉴 복원
  editingIntroMesh = null;
};

// --- Quill의 HTML을 3D plane/canvas에 그리는 함수(기본 구조) ---
function updateIntroTextPlaneFromHTML(mesh, html) {
  // 벽면서문 배경 투명도 업데이트
  updateIntroWallPlaneOpacity(mesh, html);
  // 기존 텍스트 plane 제거
  if (mesh.userData.textPlane) {
    mesh.remove(mesh.userData.textPlane);
    mesh.userData.textPlane.material.map.dispose();
    mesh.userData.textPlane.material.dispose();
    mesh.userData.textPlane.geometry.dispose();
    mesh.userData.textPlane = null;
  }
  if (!html || html.trim() === "") return;

  // 플레인의 실측(width, height, scale)로 캔버스/텍스트 계산
  const geom = mesh.geometry.parameters;
  const DPI = 2;
  // 스케일이 곱해진 '월드' 크기를 계산
  const w = (geom.width || 3) * mesh.scale.x;
  const h = (geom.height || 3) * mesh.scale.y;
  const RATIO = w / h;
  const BASE = 1024;
  const canvasW = Math.round(BASE * RATIO) * DPI;
  const canvasH = BASE * DPI;
  const marginY = canvasH * 0.10;// 상하 여백
  const marginX = canvasW * 0.12;// 좌우 여백
  const textAreaHeight = canvasH - marginY * 2;
  const textAreaWidth = canvasW - marginX * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 폰트크기 자동 조정: 플레인에 꽉 맞게!
  const minFontPx = 24 * DPI;
  const maxFontPx = Math.round(canvasH * 0.13);
  let fontRatio = maxFontPx;
  let allLineHeights = [], linesAll = [], totalTextHeight;
  let paragraphs, maxTextWidth;

  while (fontRatio > minFontPx) {
    allLineHeights = [];
    linesAll = [];
    // html 파싱
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    paragraphs = tempDiv.querySelectorAll('p, div');
    maxTextWidth = canvasW * 0.8;

    paragraphs.forEach(para => {
      let styledSpans = parseParagraphToSpans(para, DPI, fontRatio);
      let lines = wrapStyledText(ctx, styledSpans, maxTextWidth);
      lines.forEach(lineArr => {
        let maxFontPx = Math.max(...lineArr.map(span => {
          const m = span.font.match(/(\d+)px/);
          return m ? parseInt(m[1]) : fontRatio;
        }));
        let thisLineHeight = Math.round(maxFontPx * 1.35);
        allLineHeights.push(thisLineHeight);
        linesAll.push({
          lineArr,
          align: (() => {
            let align = "left";
            if (para.style.textAlign) align = para.style.textAlign;
            if (para.classList && para.classList.contains("ql-align-center")) align = "center";
            if (para.classList && para.classList.contains("ql-align-right")) align = "right";
            return align;
          })()
        });
      });
    });

    totalTextHeight = allLineHeights.reduce((a, b) => a + b, 0);
    if (totalTextHeight <= canvasH - marginY * 2) break;
    fontRatio -= 4; // 조금씩 줄여가며 반복
  }

  let curY = (canvasH - totalTextHeight) / 2;

  // 출력
  for (let i = 0; i < linesAll.length; ++i) {
    let {lineArr, align} = linesAll[i];
    let thisLineHeight = allLineHeights[i];
    let lineWidth = lineArr.reduce((sum, span) => {
      ctx.font = span.font;
      return sum + ctx.measureText(span.text).width;
    }, 0);
    let x = canvasW / 2;
    if (align === 'left') x = canvasW * 0.1;
    if (align === 'right') x = canvasW * 0.9 - lineWidth;
    if (align === 'center') x = (canvasW - lineWidth) / 2;
    let curX = x;
    lineArr.forEach(span => {
      ctx.font = span.font;
      ctx.fillStyle = span.color;
      ctx.textBaseline = "top";
      ctx.fillText(span.text, curX, curY);
      // 밑줄
      if (span.textDecoration && span.textDecoration.includes("underline")) {
        let textWidth = ctx.measureText(span.text).width;
        let y = curY + ctx.measureText('M').actualBoundingBoxAscent + 4;
        ctx.strokeStyle = span.color;
        ctx.beginPath();
        ctx.moveTo(curX, y);
        ctx.lineTo(curX + textWidth, y);
        ctx.stroke();
      }
      curX += ctx.measureText(span.text).width;
    });
    curY += thisLineHeight;
  }

  // plane 텍스처로 적용
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });

  let planeWidth = geom.width * 0.9;
  let planeHeight = geom.height * 0.9;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeHeight),
    mat
  );
  // plane 위치(박스 표면 살짝 앞에)
  let z = 0.001;
  if (geom && geom.depth !== undefined) {
    z = geom.depth / 2 + 0.001;
  }
  plane.position.set(0, 0, z);
  mesh.add(plane);
  mesh.userData.textPlane = plane;
}

function updateIntroTextPlane(mesh, text, style = {}) {
  if (mesh.userData.textPlane) {
    mesh.remove(mesh.userData.textPlane);
    mesh.userData.textPlane.material.map.dispose();
    mesh.userData.textPlane.material.dispose();
    mesh.userData.textPlane.geometry.dispose();
    mesh.userData.textPlane = null;
  }
  if (!text || text.trim() === "") return;

  // 1. geometry 비율 기반 canvas 사이즈 산출
  const geom = mesh.geometry.parameters;
  const DPI = 2;
  const w = geom.width || 3;
  const h = geom.height || 3;
  const RATIO = w / h;
  const BASE = 1024;
  const canvasW = Math.round(BASE * RATIO) * DPI;
  const canvasH = BASE * DPI;
  const marginY = canvasH * 0.10;// 상하 여백
  const marginX = canvasW * 0.12;// 좌우 여백
  const textAreaHeight = canvasH - marginY * 2;
  const textAreaWidth = canvasW - marginX * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // 2. 스타일 파라미터 적용
  const baseFontSize = style.fontSize || mesh.userData.fontSize || 26;
  const fontSize = baseFontSize * DPI; // 고해상도
  const fontFamily = style.fontFamily || mesh.userData.fontFamily || 'Nanum Gothic';
  const color = style.color || mesh.userData.fontColor || "#222";
  const lineHeight = fontSize + 8 * DPI;

  ctx.font = `bold ${fontSize}px "${fontFamily}", sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // 3. 텍스트 중앙에 줄별로 그리기
  const lines = text.split('\n');
  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, startY + i * lineHeight);
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });

  // [2] plane geometry도 크기별 고정값 사용 (0.9는 여백)
  let planeWidth = mesh.geometry.parameters.width * 0.9;
  let planeHeight = mesh.geometry.parameters.height * 0.9;
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, planeHeight),
    mat
  );

  // [3] plane 위치 - 박스 표면에 살짝
  let z = 0.001;
  if (geom.depth !== undefined) z = geom.depth / 2 + 0.001;
  plane.position.set(0, 0, z);

  mesh.add(plane);
  mesh.userData.textPlane = plane;
}

// 배율값과 폰트크기/줄간격을 매핑
const FONT_SIZE_TABLE = {
  0.5: 32,   // 6호
  0.67: 40,  // 12호
  1: 54,     // 25호(기본)
  1.5: 72,   // 50호
  2: 96      // 100호
};
const LINE_HEIGHT_TABLE = {
  0.5: 40,
  0.67: 48,
  1: 66,
  1.5: 84,
  2: 120
};

function setEditorOverlayToPlane(mesh) {
  const geom = mesh.geometry.parameters;
  // 1. 3D 플레인 4모서리 계산
  const corners = [
    new THREE.Vector3(-geom.width/2,  geom.height/2, 0),
    new THREE.Vector3( geom.width/2,  geom.height/2, 0),
    new THREE.Vector3(-geom.width/2, -geom.height/2, 0),
    new THREE.Vector3( geom.width/2, -geom.height/2, 0),
  ];
  corners.forEach(v => mesh.localToWorld(v));
  // 2. 화면 2D로 변환
  const toScreen = v => {
    v.project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight
    };
  };
  const s = corners.map(toScreen);
  // 3. 오버레이 크기/위치 산출
  const left = Math.min(...s.map(p => p.x));
  const right = Math.max(...s.map(p => p.x));
  const top = Math.min(...s.map(p => p.y));
  const bottom = Math.max(...s.map(p => p.y));
  const width = right - left;
  const height = bottom - top;
  // 4. 오버레이 스타일 적용 (16:9 직사각형)
  const overlay = document.getElementById('introTextEditorOverlay');
  const RATIO = 16 / 9; // 가로:세로
  const MIN_W = 420; // 최소 폭(px)
  const MIN_H   = 280; // 최소 높이(px)
  const TOOLBAR = 120; // 툴바·버튼 영역 높이

  // (1) 먼저 플레인 폭을 그대로 쓰고 높이를 16:9로 계산
  let oW = width;
  let oH = Math.round(width / RATIO);

  // (2) 만약 계산된 높이가 플레인보다 커지면, 높이를 기준삼아 다시 계산
  if (oH > height) {
    oH = height;
    oW = Math.round(height * RATIO);
  }
  if (oW < MIN_W) {
  oW = MIN_W;
  oH = Math.round(MIN_W / RATIO);
  }
  if (oH < MIN_H) {
  oH = MIN_H;
  oW = Math.round(MIN_H * RATIO);
  }

  // (3) 스타일 적용
  overlay.style.width  = oW + "px";
  overlay.style.height = oH + "px";
  overlay.style.left   = (left + width  / 2 - oW / 2) + "px";
  overlay.style.top    = (top  + height / 2 - oH / 2) + "px";

  // Quill 본문 높이 = 전체높이 - 툴바·버튼
  document.getElementById('quillEditor').style.cssText =
    `width:100%;height:${oH - TOOLBAR}px;`;
}

// --- 여러 스타일 span 배열을 자동 줄바꿈으로 2차원 배열로 변환 (긴 단어까지 처리) ---
function wrapStyledText(ctx, styledSpans, maxWidth) {
  let lines = [];
  let curLine = [];
  let curLineWidth = 0;
  styledSpans.forEach(span => {
    ctx.font = span.font;
    let words = span.text.split(/(\s+)/);
    words.forEach(word => {
      if (!word) return;
      let wordWidth = ctx.measureText(word).width;
      // 긴 단어(띄어쓰기 없는 긴 한글 등)도 줄바꿈 처리
      if (wordWidth > maxWidth) {
        let chars = word.split('');
        chars.forEach(char => {
          let charWidth = ctx.measureText(char).width;
          if (curLineWidth + charWidth > maxWidth && curLine.length > 0) {
            lines.push(curLine);
            curLine = [];
            curLineWidth = 0;
          }
          curLine.push({...span, text: char});
          curLineWidth += charWidth;
        });
      } else {
        if (curLineWidth + wordWidth > maxWidth && curLine.length > 0) {
          lines.push(curLine);
          curLine = [];
          curLineWidth = 0;
        }
        curLine.push({...span, text: word});
        curLineWidth += wordWidth;
      }
    });
  });
  if (curLine.length > 0) lines.push(curLine);
  return lines;
}

function parseParagraphToSpans(para, DPI, fontRatio) {
  let spans = [];
  para.childNodes.forEach(node => {
    let text = node.textContent || "";
    let style = (node.nodeType === 1) ? node.style : {};
    let color = style.color || "#222";
    let fontWeight = style.fontWeight || "normal";
    let fontStyle = style.fontStyle || "normal";
    let fontSize;
    if (style.fontSize) {
      if (style.fontSize.endsWith('px')) fontSize = parseInt(style.fontSize) * DPI;
      else if (style.fontSize.endsWith('em')) fontSize = parseFloat(style.fontSize) * 18 * DPI;
    }
    // Quill class 기준 크기 동적으로 조정
    if (node.classList && node.classList.contains('ql-size-small'))  fontSize = Math.round(fontRatio * 0.6);
    if (node.classList && node.classList.contains('ql-size-large'))  fontSize = Math.round(fontRatio * 1.5);
    if (node.classList && node.classList.contains('ql-size-huge'))   fontSize = Math.round(fontRatio * 2.0);
    if (!fontSize) fontSize = fontRatio; // 기본(normal)
    if (node.nodeType === 1 && node.tagName === 'STRONG') fontWeight = "bold";
    if (node.nodeType === 1 && node.tagName === 'EM') fontStyle = "italic";
    let textDecoration = style.textDecoration || "";
    if (node.nodeType === 1 && node.tagName === 'U') textDecoration += " underline";
    let font = `${fontWeight} ${fontStyle} ${fontSize}px "Nanum Gothic", sans-serif`;
    spans.push({text, color, font, textDecoration});
  });
  return spans;
}

function focusIntroWithEditor(mesh) {

  // **현재 카메라 상태 저장** (줌인 전)
  prevCameraPos = camera.position.clone();
  prevControlsTarget = controls.target.clone();

  // 서문 중심/하단 계산
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());

  const overlayHeight = 220; // 오버레이 실제 높이
  const usableHeight = window.innerHeight - overlayHeight;
  const vFOV = THREE.MathUtils.degToRad(camera.fov);
  const objHeight = box.max.y - box.min.y;
  let distance = (objHeight / 2) / Math.tan(vFOV / 2) * (window.innerHeight / usableHeight);
  distance *= 2.5;
  
  let normal = new THREE.Vector3(0, 0, 1);
  mesh.getWorldDirection(normal);
  const camPos = center.clone().addScaledVector(normal, distance);

  // 카메라는 항상 center를 바라봄
  const camTween = {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z
  };
  const lookTween = {
    x: controls.target.x,
    y: controls.target.y,
    z: controls.target.z
  };

  isCameraMoving = true;
  controls.enabled = false;

  new TWEEN.Tween(camTween)
    .to({ x: camPos.x, y: camPos.y, z: camPos.z }, 900)
    .easing(TWEEN.Easing.Cubic.InOut)
    .onUpdate(() => {
      camera.position.set(camTween.x, camTween.y, camTween.z);
    })
    .start();

  new TWEEN.Tween(lookTween)
    .to({ x: center.x, y: center.y, z: center.z }, 900)
    .easing(TWEEN.Easing.Cubic.InOut)
    .onUpdate(() => {
      controls.target.set(lookTween.x, lookTween.y, lookTween.z);
      controls.update();
    })
    .onComplete(() => {
      isCameraMoving = false;
      controls.enabled = true;
      
      showOverlayEditorFixed(mesh)
    })
    .start();
}

function showOverlayEditorFixed(mesh) { // 오버레이 텍스트에디터 열기 -> 중앙 하단 고정
  hidePaintingEditButtons();
  setEditorOverlayToPlane(mesh);

  // 새 편집 대상으로 업데이트
  editingIntroMesh = mesh;
  setupQuillEditor();

  quill.off('text-change');
  if (mesh.userData.html && mesh.userData.html.trim() !== "") {
    quill.clipboard.dangerouslyPasteHTML(mesh.userData.html, 'silent');
    editingIntroHTML = mesh.userData.html;
  } else {
    quill.setText('', 'silent');
    editingIntroHTML = '';
  }
  quill.on('text-change', function() {
    editingIntroHTML = quill.root.innerHTML;
    updateIntroTextPlaneFromHTML(mesh, editingIntroHTML);
  });
  updateIntroTextPlaneFromHTML(mesh, quill.root.innerHTML);

  const overlay = document.getElementById('introTextEditorOverlay');
  overlay.style.display = 'block';
  overlay.style.position = 'fixed';
  overlay.style.left = '50%';
  overlay.style.transform = 'translateX(-50%)';
  overlay.style.zIndex = 1100;

  const margin = 32; // 화면 하단에서 32px 띄움 (원하는 값으로 조정)
  // 반드시 display: block 후에 높이 측정!
  const { height: overlayHeight } = overlay.getBoundingClientRect();

  // 브라우저 화면 하단에서 margin만큼 위로 (너무 위로 가지 않게 min값 적용)
  let top = window.innerHeight - overlayHeight - margin;
  if (top < margin) top = margin;
  overlay.style.top = `${top}px`;
}

function isActuallyEmpty(html) {
  if (!html) return true;
  const stripped = html
    .replace(/<br\s*\/?>/gi, "")
    .replace(/<(p|div)>\s*<\/\1>/gi, "")
    .replace(/&nbsp;/gi, "")
    .replace(/\s+/g, "");
  return stripped === "";
}

function updateIntroWallPlaneOpacity(mesh, html) {
  // intro-plane만 적용
  if (mesh.userData.type === 'intro-plane') {
    let hasText = !isActuallyEmpty(html);
    mesh.material.opacity = hasText ? 0 : 0.8;
    mesh.material.transparent = true;
  }
}

function showFrameColorPicker(mesh) {
  // 기존 색상 백업
  const prevColor = mesh.material[4].color.getHexString();

  // 이미 열린 팔레트 있으면 중복 방지
  if (document.getElementById('frameColorPalette')) return;

  isColorPicking = true;

  const palette = document.createElement('div');
  palette.className = 'overlay-panel';
  palette.id = 'frameColorPalette';

  palette.addEventListener('mousedown', e => e.stopPropagation()); // 팔레트 안 클릭은 전역으로 퍼지지 않음 -> 파랑테두리 유지

  // 팔레트 컨테이너 생성
  const colors = [
  '#ffffff', '#f8b400', '#fa5252', '#2061e6', '#12b886',
  '#eeeeee', '#333333', '#a17a5b', '#ba9bf9'
  ];

  // 첫 줄: 5개, 둘째 줄: 4개 + 컬러피커
  const colorRows = [colors.slice(0, 5), colors.slice(5, 9)];

  const paletteDiv = document.createElement('div');
  paletteDiv.className = 'color-palette';

  colorRows.forEach((rowColors, rowIdx) => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'color-row';

    rowColors.forEach(color => {
      const colorBtn = document.createElement('button');
      colorBtn.className = 'color-pick-btn';
      colorBtn.style.background = color;
      colorBtn.addEventListener('click', () => {
        mesh.material[4].color.set(color);
        mesh.userData.frameColorTemp = color;
        document.querySelectorAll('.color-pick-btn').forEach(btn => btn.classList.remove('selected'));
        colorBtn.classList.add('selected');
      });
      rowDiv.appendChild(colorBtn);
    });

    // ── 두 번째 줄 끝 : “사용자 지정 색상” ─────────────
    if (rowIdx === 1) {
      /* 1. 🌈 대신 input 자체를 버튼처럼 */
      const customInput = document.createElement('input');
      customInput.type  = 'color';
      customInput.className = 'color-pick-btn';   // 버튼과 같은 둥근 스타일
      customInput.style.padding = '0';            // 여백 제거
      customInput.style.cursor  = 'pointer';      // 손가락 커서
      customInput.value = '#' + prevColor;        // 초기 색

      /* 2. 색을 고르면 즉시 반영 */
      customInput.addEventListener('input', e => {
        const hex = e.target.value;
        mesh.material[4].color.set(hex);
        mesh.userData.frameColorTemp = hex;

        customInput.style.background = hex;

        document.querySelectorAll('.color-pick-btn')
                .forEach(b => b.classList.remove('selected'));
        customInput.classList.add('selected');
      });

      rowDiv.appendChild(customInput);      
    }

  paletteDiv.appendChild(rowDiv);
  });
  palette.appendChild(paletteDiv);


  // 확인/취소 버튼
  const okBtn = document.createElement('button');
  okBtn.textContent = '확인';
  okBtn.addEventListener('click', () => {
    // 색상 확정: userData, DB 등에 저장
    mesh.userData.frameColor = mesh.userData.frameColorTemp || ('#' + prevColor);
    // 팔레트 닫기
    document.body.removeChild(palette);
    isColorPicking = false;
    mesh.userData.frameColorTemp = null;
    // 편집 버튼 복귀
    showPaintingEditButtons(mesh);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => {
    // 취소: 기존 색상 복원
    mesh.material[4].color.set('#' + prevColor);
    mesh.userData.frameColorTemp = null;
    document.body.removeChild(palette);
    isColorPicking = false;
    showPaintingEditButtons(mesh);
  });

  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';

  buttonRow.appendChild(okBtn);
  buttonRow.appendChild(cancelBtn);

  palette.appendChild(buttonRow);

  document.body.appendChild(palette);
  // 편집 버튼 숨기기
  editingButtonsDiv.style.display = 'none';
}

// "작품이야기" 버튼을 눌렀을 때 호출되는 함수
function showPaintingStoryEditor(mesh) {
  // 이미 열린 오버레이가 있으면 중복 생성 방지
  if (document.getElementById('paintingStoryEditorOverlay')) return;
  isStoryEditing = true;

  // 버튼 숨기기
  editingButtonsDiv.style.display = 'none';

  // === 오버레이 패널 생성 ===
  const overlay = document.createElement('div');
  overlay.className = 'overlay-panel';
  overlay.id = 'paintingStoryEditorOverlay';

  // 오버레이 클릭시 닫히지 않도록(e.stopPropagation)
  overlay.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  // === 타이틀/설명 ===
  const data = mesh.userData.data || {};
  const title = document.createElement('div');
  title.textContent = data.title || '(제목 없음)';
  title.style.fontWeight = 'bold';
  title.style.fontSize = '20px';
  title.style.marginBottom = '14px';
  overlay.appendChild(title);

  // === Quill 에디터 컨테이너 생성 ===
  const editorDiv = document.createElement('div');
  editorDiv.id = 'paintingStoryQuill';
  editorDiv.style.width = '280px';
  editorDiv.style.height = '150px';
  editorDiv.style.background = '#fff';
  /*editorDiv.style.marginBottom = '16px';*/
  overlay.appendChild(editorDiv);

  // === 기존 작품설명(기본값) 불러오기 ===
  // json에서 넘어온 설명: mesh.userData.data.description 등에서 가져옴
  // (설명이 저장되어 있다면 최신값, 없으면 "")

  let prevText = '';
  if (mesh.userData.story) {
    // 이미 사용자가 입력한 값이 있으면
    prevText = mesh.userData.story;
  } else if (mesh.userData.data && mesh.userData.data.description) {
    // 최초에는 json에서 온 설명 사용
    prevText = mesh.userData.data.description;
  } else {
    prevText = '';
  }

  // === Quill 에디터 실제 생성 ===
  // 기존 intro/서문에서 쓰던 옵션 복사해서 붙여도 됨!
  const quill = new Quill(editorDiv, {
    theme: 'snow',
    modules: {
      toolbar: false
    }
  });

  // 초기값 채우기
  quill.root.innerHTML = prevText;

  // === 버튼 영역 (확인/취소) ===
  const buttonRow = document.createElement('div');
  buttonRow.className = 'button-row';

  // 확인 버튼
  const okBtn = document.createElement('button');
okBtn.textContent = '확인';
okBtn.onclick = function() {
  // 텍스트 저장(HTML)
  const html = quill.root.innerHTML;
  mesh.userData.story = html;

  selectedPainting = mesh; 

  // 필요하다면 mesh.userData.data.description = html; 도 가능!
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }
  // 외부클릭차단 해제 / 오버레이 제거
  isStoryEditing = false;
  // overlay.remove; ← 이 줄은 필요 없다면 삭제해도 됨

  // 필요하면 작품정보(info) 새로고침/업데이트 함수 호출
  updatePaintingInfo(mesh);

  // **showPaintingEditButtons(mesh); 호출은 주석처리 또는 삭제!**
  // showPaintingEditButtons(mesh);

  // 대신, infoModal을 여기서 띄우세요!
  showInfo(); // infoModal 오픈
};
buttonRow.appendChild(okBtn);


  // 취소 버튼
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.onclick = function() {
    if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
    }
    // (3) 외부 클릭 차단 해제 & 오버레이 제거
    isStoryEditing = false;
    overlay.remove

    showPaintingEditButtons(mesh);
  };
  buttonRow.appendChild(cancelBtn);

  overlay.appendChild(buttonRow);

  // === 오버레이를 body에 추가 ===
  document.body.appendChild(overlay);

  // === 필요시 에디터 자동 포커스 ===
  setTimeout(() => {
    quill.focus();
    
    // 1) 에디터 실제 렌더된 컨테이너 폭 측정
    const editorWidth = overlay.querySelector('.ql-container').getBoundingClientRect().width;

    // 2) infoModal의 컨텐츠 영역에도 똑같이 설정
    const infoContent = document.querySelector('#infoModal .info-content');
    if (infoContent) {
      infoContent.style.width = `${editorWidth}px`;
      infoContent.style.boxSizing = 'border-box';
    }
  }, 0);

}

// 예시: 작품 선택 → showPaintingEditButtons(mesh) → 작품이야기 버튼 생성
// storyBtn.onclick = () => showPaintingStoryEditor(mesh);

function updatePaintingInfo(mesh) {
  const infoContent = document.getElementById('infoContent');
  if (!infoContent) return;
  
  /* userData.story가 있으면 사용자 설명, 아니면 기본 설명
  const html = mesh.userData.story || (mesh.userData.data && mesh.userData.data.description) || '(설명 없음)';
  infoContent.innerHTML = html;*/

  const data = mesh.userData.data || {};
  const story = mesh.userData.story?.trim()
    ? mesh.userData.story
    : data.description || '(설명 없음)';

  infoContent.innerHTML = `
    <h2>${data.title || '(제목 없음)'}</h2>
    <p>${story}</p>
  `;

  document.getElementById('infoModal').style.display = 'block';
}

function zoomBackOut() {
  if (!prevCameraPos || !prevControlsTarget) return;

  const startCam = camera.position.clone();
  const startTarget = controls.target.clone();
  const state = { t: 0 };

  isCameraMoving = true;
  controls.enabled = false;

  new TWEEN.Tween(state)
    .to({ t: 1 }, 900)
    .easing(TWEEN.Easing.Cubic.InOut)
    .onUpdate(({ t }) => {
      camera.position.lerpVectors(startCam, prevCameraPos, t);
      controls.target.lerpVectors(startTarget, prevControlsTarget, t);
      controls.update();
    })
    .onComplete(() => {
      isCameraMoving = false;
      // 초기화
      prevCameraPos = null;
      prevControlsTarget = null;
    })
    .start();
}

function cancelIntroChanges() {
  // 1) 새로 만든 intro 메쉬 제거
  for (let mesh of tempIntroMeshes) {
    scene.remove(mesh);
    const idx = paintings.indexOf(mesh);
    if (idx !== -1) paintings.splice(idx, 1);
  }
  tempIntroMeshes = [];

  // 2) 원본 intro 객체 위치·회전·텍스트 복원
  for (let {mesh, position, rotation, html} of originalIntroState) {
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    mesh.userData.html = html;
    updateIntroTextPlaneFromHTML(mesh, html);
  }
  originalIntroState = [];
}

/* -------- [ARTWALL] 썸네일 -------- */
function populateArtwallGrid() {
  const grid = document.getElementById("artwallGrid");
  if (!grid) return;

  grid.innerHTML = "";
  const start = currentArtwallsPage * artwallsItemsPerPage;
  const end   = start + artwallsItemsPerPage;

  artwallsData.slice(start, end).forEach(wall => {
    const img = document.createElement("img");
    img.src = `https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/artwalls/${wall.filename}`;
    img.alt = wall.title || "";
    img.draggable = true;
    img.classList.add("thumbnail");
    img.addEventListener("dragstart", e =>
      e.dataTransfer.setData("artwall", JSON.stringify(wall))
    );
    grid.appendChild(img);
  });

  updateArtwallPageButtons();
}

function updateArtwallPageButtons() {
  const prev = document.getElementById("prevArtPageBtn");
  const next = document.getElementById("nextArtPageBtn");
  const max  = Math.floor((artwallsData.length - 1) / artwallsItemsPerPage );
  prev.disabled = artwallsItemsPerPage === 0;
  next.disabled = artwallsItemsPerPage >= max;
}

document.getElementById("prevArtPageBtn").addEventListener("click", () => {
  if (currentArtwallsPage > 0) { currentArtwallsPage--; populateArtwallGrid(); }
});
document.getElementById("nextArtPageBtn").addEventListener("click", () => {
  const max = Math.floor((artwallsData.length - 1) / artwallsItemsPerPage );
  if (artwallsItemsPerPage < max) { artwallsItemsPerPage++; populateArtwallGrid(); }
});

/* -------- [ARTWALL] PlaneGeometry 생성 -------- */
function loadAndAddArtwall(data, position, rotationY) {
  return new Promise((resolve, reject) => {
    const url = `https://raw.githubusercontent.com/GuatemalanGirl/mygallery/main/artwalls/${data.filename}`;
    textureLoader.load(
      url,
      tx => {
        const aspect = tx.image.width / tx.image.height;
        const height = ROOM_HEIGHT;            // 항상 천장~바닥
        let   width  = height * aspect;

        const maxWidth = ["left","right"].includes(currentWall)
                       ? ROOM_DEPTH : ROOM_WIDTH;
        width = Math.min(width, maxWidth);

        const geo = new THREE.PlaneGeometry(width, height);
        const mat = new THREE.MeshBasicMaterial({ map: tx, transparent: true, opacity: 0.8 }); // 아트월 이미지에 투명도 적용
        const mesh = new THREE.Mesh(geo, mat);

        mesh.position.copy(position);
        mesh.rotation.y = rotationY;
        // 살짝 띄워 Z-파이팅 방지
        const n = new THREE.Vector3(0,0,1).applyQuaternion(mesh.quaternion);
        mesh.position.add(n.multiplyScalar(0.01));

        mesh.userData.isArtwall = true;
        scene.add(mesh);
        artwalls.push(mesh);
        resolve(mesh);
      },
      undefined, reject);
  });
}

function handleApplyArtwalls() {
  isArtwallMode = false;
  controls.enabled = true;
  originalArtwallsState = [...artwalls];   // 확정
  tempArtwalls = [];
  showPanel("panel-main");
}
document.getElementById("applyArtwallsButton")
        .addEventListener("click", handleApplyArtwalls);

function cancelArtwallChanges() {
  tempArtwalls.forEach(m => {
    scene.remove(m);
    m.geometry?.dispose();
    m.material?.map?.dispose();
    m.material?.dispose();
  });
  tempArtwalls = [];
}

function startEditingArtwall(mesh){
  editingArtwall = mesh;
  showOutline(mesh);               // 테두리 효과 함수 (공통)
  showArtwallButtons(mesh);       // 삭제버튼 등 UI 표시
}
function endEditingArtwall(){
  if (!editingArtwall) return;
  removeOutline(editingArtwall);  // 테두리 제거 (공통)
  editingButtonsDiv.style.display = "none";
  editingArtwall = null;
}
function showArtwallButtons(mesh){
  editingButtonsDiv.innerHTML = "";
  const del = document.createElement("button");
  del.textContent = "삭제";
  del.onclick = () => {
    scene.remove(mesh);
    artwalls.splice(artwalls.indexOf(mesh),1);
    endEditingArtwall();
  };
  editingButtonsDiv.appendChild(del);
  editingButtonsDiv.style.display = "block";
}

function enterArtwallMode(){
  isArtwallMode = true;
  controls.enabled = false;      // 3D 시점 고정
}
function exitArtwallMode(){
  isArtwallMode = false;
  controls.enabled = true;       // 3D 시점 자유
  endEditingArtwall();           // 편집 모드 종료
}

function updatePointer(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function onResizeHandlePointerDown(event) {
  if (!resizeHandleMesh) return;
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(resizeHandleMesh);
  if (hits.length) {
    const mesh = resizeHandleMesh.userData.targetMesh;
    if (!mesh) return; // 추가: null 안전!
    isResizingWithHandle = true;
    dragPlane.setFromNormalAndCoplanarPoint(
      camera.getWorldDirection(new THREE.Vector3()).negate(),
      resizeHandleMesh.position
    );
    raycaster.ray.intersectPlane(dragPlane, dragStartPoint);
    mesh.userData._resizeOrigScale = mesh.userData.originalScale.clone();
  }
}

function onResizeHandlePointerMove(event) {
  if (!isResizingWithHandle || !resizeHandleMesh) return;
  const mesh = resizeHandleMesh.userData.targetMesh;
  if (!mesh) return; // 추가: null 안전!
  const orig = mesh.userData._resizeOrigScale;
  if (!orig) return; // 추가: null 안전!
  updatePointer(event);
  raycaster.setFromCamera(pointer, camera);
  raycaster.ray.intersectPlane(dragPlane, dragCurrentPoint);

  // 핸들러 위치를 마우스 위치(3D)에 맞춘다
  resizeHandleMesh.position.copy(dragCurrentPoint);
  
  /* 월드 → 로컬 좌표로 변환해 Δ 계산 */
  const localStart   = mesh.worldToLocal(dragStartPoint.clone());
  const localCurrent = mesh.worldToLocal(dragCurrentPoint.clone());
  const deltaLocal   = localCurrent.clone().sub(localStart);

  // 핸들러 크기 조절 범위 -> 최소 0.5배, 최대 2배
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 2.0;

  if (mesh.userData.type === 'intro-frame' || mesh.userData.type === 'intro-plane') {
    // 서문(사각형) → x/y축 각각 자유 조절
    // delta.x/y를 활용
    let factorX = 1 + deltaLocal.x;
    let factorY = 1 + deltaLocal.y;
    factorX = Math.max(MIN_SCALE, Math.min(MAX_SCALE, factorX));
    factorY = Math.max(MIN_SCALE, Math.min(MAX_SCALE, factorY));

    // 쉬프트키 누르면 정비율(정사각형)
    if (event.shiftKey) {
      // 비율을 맞춤: x/y 둘 중 큰 증가량에 맞춰 둘 다 동일하게
      const factor = Math.max(Math.abs(factorX), Math.abs(factorY)) * Math.sign(factorY);
      mesh.scale.x = orig.x * factor;
      mesh.scale.y = orig.y * factor;
    } else {
      mesh.scale.x = orig.x * factorX;
      mesh.scale.y = orig.y * factorY;
    }
    // z(두께)는 그대로 유지!
  } else {
    // ---- 기존 그림(정사각형 등) → 비율 고정 크기조절 ----
    let factor = 1 + deltaLocal.y;
    const clampedFactor = Math.max(MIN_SCALE, Math.min(MAX_SCALE, factor));
    mesh.scale.set(
      orig.x * clampedFactor,
      orig.y * clampedFactor,
      orig.z
    );
  }

  // 프레임·플레인 서문이면 실시간으로 텍스트 업데이트
  if (mesh.userData.type?.startsWith('intro') && mesh.userData.html) {
    updateIntroTextPlaneFromHTML(mesh, mesh.userData.html);
  }

  showOutline(mesh);
  updateResizeHandlePosition(mesh);
}

function onResizeHandlePointerUp() {
  if (!isResizingWithHandle || !resizeHandleMesh) return;
  isResizingWithHandle = false;
  const mesh = resizeHandleMesh.userData.targetMesh;
  if (!mesh || !mesh.userData.originalScale) return; // 추가: null 안전!
  mesh.userData.scaleValue = mesh.scale.x / mesh.userData.originalScale.x;

  // 프레임·플레인 서문이면 실시간으로 텍스트 업데이트
  if (mesh.userData.type?.startsWith('intro') && mesh.userData.html) {
    updateIntroTextPlaneFromHTML(mesh, mesh.userData.html);
  }

}

function createResizeHandle(mesh) {
  //핸들러가 이미 있으면 삭제
  if (resizeHandleMesh) scene.remove(resizeHandleMesh);

  const handleWidth = 0.5;
  const handleHeight = 0.5;
  let handleDepth, geom;

  if (mesh.geometry.type === 'BoxGeometry') {
    const baseDepth = mesh.geometry.parameters?.depth ?? 0.1; // 기본 두께 0.1
    handleDepth = baseDepth * mesh.scale.z;
    geom = new THREE.BoxGeometry(handleWidth, handleHeight, handleDepth);
  } else if (mesh.geometry.type === 'PlaneGeometry') {
    handleDepth = 0.01; // 평면 핸들러라면
    geom = new THREE.PlaneGeometry(handleWidth, handleHeight);
  }

  const mat  = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8, side: THREE.DoubleSide });
  resizeHandleMesh = new THREE.Mesh(geom, mat);
  resizeHandleMesh.userData.targetMesh = mesh;
  scene.add(resizeHandleMesh);
  resizeHandleMesh.position.copy(mesh.position);
  updateResizeHandlePosition(mesh);
}

function updateResizeHandlePosition(mesh) {
  const box = new THREE.Box3().setFromObject(mesh);

  let corner;
  switch (currentWall) {
    case "front":
      // 오른쪽 위 앞
      corner = new THREE.Vector3(box.min.x, box.max.y, box.min.z); // 좌우, 상하, 앞뒤
      break;
    case "back":
      // 오른쪽 위 앞 (back은 법선만 다르고 위치는 front와 같음)
      corner = new THREE.Vector3(box.max.x, box.max.y, box.max.z); // 좌우, 상하, 앞뒤
      break;
    case "left":
      // left는 z가 x축 역할. 오른쪽(방기준)은 z가 +, 위는 y+
      corner = new THREE.Vector3(box.min.x, box.max.y, box.max.z); // 앞뒤, 상하, 좌우
      break;
    case "right":
      // right도 z가 x축 역할, but 위치가 반대. (방기준 오른쪽)
      corner = new THREE.Vector3(box.max.x, box.max.y, box.min.z); // 앞뒤, 상하, 좌우
      break;
  }

  resizeHandleMesh.position.copy(corner);
  resizeHandleMesh.quaternion.copy(mesh.quaternion);
  resizeHandleMesh.visible = true;
}

/**
 * 프레임 크기 변화 후 텍스트 스케일을 재계산
 * @param {THREE.Mesh} frameMesh  플레임(박스/플레인) 메쉬
 */
function updateIntroTextScale(frameMesh) {
  const textMesh = frameMesh.userData.textMesh;
  if (!textMesh) return;

  // 최초 생성 시 저장해 둔 "기준 프레임 스케일"
  const baseFrameScale = frameMesh.userData._baseScale; // {x,y}
  const sx = frameMesh.scale.x / baseFrameScale.x;
  const sy = frameMesh.scale.y / baseFrameScale.y;

  // ⬇️ ① fitInside : 짧은 변에 맞춰 글씨를 줄임
  const s = Math.min(sx, sy);

  // ⬇️ ② fitOutside 방식이 좋다면 Math.max(sx, sy) 사용
  // const s = Math.max(sx, sy);

  textMesh.scale.set(s, s, s);

  // 글자를 프레임 중앙에 재정렬 (선택)
  const bbox = new THREE.Box3().setFromObject(textMesh);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  textMesh.position.set(
    -size.x * 0.5,
    -size.y * 0.5,
    0.001          // z-offset 살짝 앞으로
  );
}

window.onload = initApp

window.showPanel = function (panelId) {
  // InfoModal 열려 있으면 우선 닫기
  const modal = document.getElementById("infoModal");
  if (modal && modal.style.display === "block") {
    closeInfo();
  }
  const currentActive = document.querySelector(".settings-slide.active")
  const currentId = currentActive?.id

  // 패널 전환 시, panel-artwalls → 다른 패널로 나갈 때 outline 정리
  if (currentId === "panel-artwalls" && panelId !== "panel-artwalls") {
    endEditingArtwall(); //
  }

  // 백그라운드 → 메인으로 이동할 때만 복원
  if (currentId === "panel-background" && panelId === "panel-main") {
     if (!skipCancelBackground) restoreTextureSet();
  }

  if (currentId === "panel-paintings" && panelId === "panel-main") {
    if (!skipCancelPainting) {
    cancelPaintingChanges() // <- 버튼으로 빠질 때 복원
    }
    endEditingPainting() // 작품선택(배치)모드 종료
  }

  if (["panel-paintings", "panel-intro", "panel-artwalls"].includes(panelId)) {
    populatePaintingGrid()
    isPaintingMode = true // 작품선택모드 진입
    controls.enabled = false // 사용자 회전 비활성화
    currentWall = "front" // front부터 시작
    updateWallView() // 카메라 이동
    document.getElementById("navButtons").classList.add("slide-down"); // 하단 버튼 숨기기

    //현재 상태 복사
    originalPaintings = [...paintings]
    tempPaintings = []

    // 현재 그림 상태 저장
    originalPaintingsState = paintings.map((mesh) => ({
      mesh: mesh,
      position: mesh.position.clone(),
      rotation: mesh.rotation.clone(),
      scale: mesh.scale.clone(),
      story: mesh.userData.story ||                // 사용자가 작성한 그림이야기
             mesh.userData.data?.description || "" // 그림이야기 metadata.json 원본
    }))
  } else {
    isPaintingMode = false // 작품 선택 모드 해제
    controls.enabled = true;
    document.getElementById("navButtons").classList.remove("slide-down"); // 하단 버튼 다시 표시
  }

  // --- 패널이 panel-intro 에서 panel-main 으로 돌아갈 때 롤백 ---
  if (currentId === "panel-intro" && panelId === "panel-main") {
    if (!skipCancelIntro) {
      cancelIntroChanges();
    }
  }

  if (panelId === "panel-intro") {
    isIntroMode = true;
    // 기존 intro-frame / intro-plane 객체들 스냅샷
    originalIntroState = paintings
      .filter(m => m.userData.type === 'intro-frame' || m.userData.type === 'intro-plane')
      .map(mesh => ({
        mesh,
        position: mesh.position.clone(),
        rotation: mesh.rotation.clone(),
        html: mesh.userData.html || ""
      }));
    // 새로 만든 intro 메쉬들 추적용 배열 초기화
    tempIntroMeshes = [];
  } else {
    isIntroMode = false;
  }

    if (currentId === "panel-artwalls" && panelId === "panel-main") {
    cancelArtwallChanges();       // ↙ ⑧에서 정의
    isArtwallMode = false;
  }

  if (panelId === "panel-artwalls") {
    populateArtwallGrid();
    isArtwallMode = true;
    controls.enabled = false;
    currentWall = "front";
    updateWallView();

    originalArtwallsState = [...artwalls];
    tempArtwalls = [];
  } else {
    isArtwallMode = false;
  }

  // 모든 패널에서 active 클래스 제거 후, 선택한 패널에만 추가
  document.querySelectorAll(".settings-slide").forEach((panel) => {
    panel.classList.remove("active")
  })
  document.getElementById(panelId).classList.add("active")
}
