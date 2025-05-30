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

let editingButtonsDiv = document.getElementById("paintingEditButtons"); // 하단 버튼 컨테이너
// 편집버튼 클릭 시, 이벤트 전파 차단 (편집 종료 안 되게!)
editingButtonsDiv.addEventListener("mousedown", function(e) {
  e.stopPropagation();
});


let skipCancelPainting = false // 설정 패널 전환 시 복원 스킵할지 여부

let currentPage = 0;
const itemsPerPage = 9;

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

  // 드래그 앤 드롭 이벤트 등록
  renderer.domElement.addEventListener("dragover", (e) => {
    e.preventDefault() // 기본 동작 방지
  })

  renderer.domElement.addEventListener("drop", (e) => {
    e.preventDefault()
    const paintingRaw = e.dataTransfer.getData("painting")
    if (!paintingRaw) {
      console.warn("No painting data found")
      return
    }

    let paintingData;
    try {
      paintingData = JSON.parse(paintingRaw);
    } catch (err) {
      console.error("Invalid painting data:", err);
      return;
    }
    console.log("Dropped painting:", paintingData);

    const rect = renderer.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )

    raycaster.setFromCamera(mouse, camera)

    const wallMesh = scene.getObjectByName(currentWall)
    if (!wallMesh) {
      console.warn("Wall not found:", currentWall)
      return
    }

    const intersects = raycaster.intersectObject(wallMesh)
    console.log("Intersects:", intersects)

    if (intersects.length > 0) {
      const point = intersects[0].point.clone()
      const normal = intersects[0].face.normal
        .clone()
        .transformDirection(wallMesh.matrixWorld)
      point.add(normal.multiplyScalar(0.05))

      // 임시 그림을 만들기 전에 벽 안으로 제한
      const halfW = ROOM_WIDTH / 2;
      const halfH = ROOM_HEIGHT / 2;
      const halfD = ROOM_DEPTH / 2;
      const margin = 1; // 최소 여백

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
      }[currentWall]

      loadAndAddPainting(paintingData, point, wallRotY).then((mesh) => {
        tempPaintings.push(mesh) // 나중에 제거할 대상 추적
      })
    } else {
      console.warn("No intersection with wall.")
    }
  })

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
    const hits = raycaster.intersectObjects(paintings);
    if (hits.length > 0) {
      selectedPainting = hits[0].object;
    }
  });

  renderer.domElement.addEventListener("pointerup", (e) => {
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
    if (!isPaintingMode || !e.buttons || !dragStartScreen) return;

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
      event.preventDefault() // 스크롤 방지
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
}

function closeInfo() {
  document.getElementById("infoModal").style.display = "none"
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
    if (currentId === "panel-paintings") {
      cancelPaintingChanges() // 작품선택 중이면 복원
      updateWallView() // 시점 복원 (카메라 고정 해제)
      controls.enabled = true // 마우스 조작 복원
      endEditingPainting() // 작품선택(배치)모드 종료
      isPaintingMode = false // 명시적으로 모드 비활성화
      document.getElementById("navButtons").classList.remove("slide-down"); // 하단 버튼
      restoreTextureSet()
    }
    panel.classList.remove("open")
    gear.classList.remove("moving")
  } else {
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

    localStorage.setItem("selectedTextureSet", selectedTextureSet)
  })

function populatePaintingGrid() {
  const grid = document.getElementById("paintingGrid")
  if (!grid) return

  grid.innerHTML = "" // 기존 내용 초기화

  const start = currentPage * itemsPerPage;
  const end = start + itemsPerPage;
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

    grid.appendChild(thumb)

    document
      .getElementById("applyPaintingsButton")
      .addEventListener("click", () => {
        isPaintingMode = false
        controls.enabled = true
        originalPaintings = [...paintings] // 확정
        // 현재 위치를 확정 저장
        originalPaintingsState = paintings.map((mesh) => ({
          mesh: mesh,
          position: mesh.position.clone(),
          rotation: mesh.rotation.clone(),
          scale: mesh.scale.clone(),
        }))
        tempPaintings = []
        updatePaintingOrderByPosition() // 확인 버튼 클릭 시 순서 재정렬
        // 설정 패널 전환 시 복원 방지
        skipCancelPainting = true
        showPanel("panel-main") // 설정 메인으로 복귀
        skipCancelPainting = false
      })
  })
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


let currentWall = "front" // 초기값
const wallNames = ["front", "right", "back", "left"]

document.getElementById("wallLeftButton").addEventListener("click", () => {
  const idx = wallNames.indexOf(currentWall)
  const newIdx = (idx - 1 + wallNames.length) % wallNames.length
  currentWall = wallNames[newIdx]
  updateWallView()
})

document.getElementById("wallRightButton").addEventListener("click", () => {
  const idx = wallNames.indexOf(currentWall)
  const newIdx = (idx + 1) % wallNames.length
  currentWall = wallNames[newIdx]
  updateWallView()
})

function updateWallView() {
  const label = document.getElementById("currentWallLabel")
  label.textContent = currentWall.charAt(0).toUpperCase() + currentWall.slice(1)

  // 카메라 시점 고정
  let pos = new THREE.Vector3()
  let look = new THREE.Vector3(0, PAINTING_Y_OFFSET, 0)
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

function cancelPaintingChanges() {
  for (let mesh of tempPaintings) {
    scene.remove(mesh)
    paintings.splice(paintings.indexOf(mesh), 1) // paintings에서도 제거
  }
  tempPaintings = []

  // 기존 그림 위치 복원
  originalPaintingsState.forEach(({ mesh, position, rotation, scale }) => {
    mesh.position.copy(position)
    mesh.rotation.copy(rotation)
    if (scale) {mesh.scale.copy(scale);
    } else if (mesh.userData.originalScale) {
      mesh.scale.copy(mesh.userData.originalScale); // 크기 조절 복원
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
  if (!isPaintingMode || !mesh) return;
  isResizingPainting = false; // 편집 진입할 때는 항상 false
  editingButtonsDiv.innerHTML = `
    <button id="resizeBtn">작품크기조절</button>
    <button id="deleteBtn">삭제</button>
  `;
  editingButtonsDiv.style.display = "flex";

  document.getElementById("resizeBtn").onclick = () => {
    showResizeSizeButtons(mesh);
  }
  document.getElementById("deleteBtn").onclick = () => {
    deletePainting(mesh);
  }
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
}

function hidePaintingEditButtons() {
  editingButtonsDiv.style.display = "none";
  editingButtonsDiv.innerHTML = "";
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

  let currentScaleValue = mesh.userData.scaleValue;

  editingButtonsDiv.innerHTML = `
    <div style="display:flex;gap:8px;justify-content:center;">
      ${scaleList.map(s =>
        `<button class="scale-btn" data-scale="${s.value}" ${s.value===currentScaleValue?'style="background:#c7eaff;"':''}>${s.label}</button>`
      ).join("")}
    </div>
    <button id="resizeOkBtn">확인</button>
    <button id="resizeCancelBtn">취소</button>
  `;

  // 버튼 생성 후, 진입 시 현재 배율 버튼만 하이라이트!
  const btns = document.querySelectorAll('.scale-btn');
  btns.forEach(btn => {
    if (parseFloat(btn.getAttribute('data-scale')) === currentScaleValue) {
      btn.style.background = "#ffffff";
    } else {
      btn.style.background = "";
    }
  });


  let tempScaleValue = currentScaleValue; // 임시 선택값

  // 각 배율 버튼 클릭시
  document.querySelectorAll('.scale-btn').forEach(btn => {
    btn.onclick = () => {
      tempScaleValue = parseFloat(btn.getAttribute('data-scale'));
      // 원본스케일 x 선택배율
      const orig = mesh.userData.originalScale;
      mesh.scale.set(
        orig.x * tempScaleValue,
        orig.y * tempScaleValue,
        orig.z
      );
      // 버튼 하이라이트 효과
      document.querySelectorAll('.scale-btn').forEach(b=>b.style.background="");
      btn.style.background = "#ffffff";
      // outline도 배율 바뀔 때마다 갱신
      showOutline(mesh);
    };
  });

  // 확인 버튼
  document.getElementById("resizeOkBtn").onclick = () => {
    // mesh에 최종값 저장
    mesh.userData.scaleValue = tempScaleValue;

    // outline 크기 갱신
    if (isEditingPainting && editingPainting === mesh) {
      showOutline(mesh); // 테두리 다시 만듦
    }

    // 이미 scale 적용됨
    isResizingPainting = false;
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
    showPaintingEditButtons(mesh);
  };
}

function deletePainting(mesh) {
  scene.remove(mesh);
  const idx = paintings.indexOf(mesh);
  if (idx !== -1) paintings.splice(idx, 1);
  endEditingPainting();
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

window.onload = initApp

window.showPanel = function (panelId) {
  const currentActive = document.querySelector(".settings-slide.active")
  const currentId = currentActive?.id

  // 백그라운드 → 메인으로 이동할 때만 복원
  if (currentId === "panel-background" && panelId === "panel-main") {
    restoreTextureSet()
  }

  if (currentId === "panel-paintings" && panelId === "panel-main") {
    if (!skipCancelPainting) {
    cancelPaintingChanges() // <- 버튼으로 빠질 때 복원
    }
    endEditingPainting() // 작품선택(배치)모드 종료
  }

  if (panelId === "panel-paintings") {
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
    }))
  } else {
    isPaintingMode = false // 작품 선택 모드 해제
    controls.enabled = true;
    document.getElementById("navButtons").classList.remove("slide-down"); // 하단 버튼 다시 표시
  }

  document.querySelectorAll(".settings-slide").forEach((panel) => {
    panel.classList.remove("active")
  })
  document.getElementById(panelId).classList.add("active")
}
