/**
 * TÂM CÁC ĐOẠN ĐƯỜNG TRÙNG TÊN Ở NHIỀU QUẬN CŨ CỦA TP.HCM — file TẠO TỰ ĐỘNG bởi scripts/build_hcm_street_segments.mjs, KHÔNG sửa tay.
 * Nguồn: dữ liệu OpenStreetMap (© OpenStreetMap contributors, giấy phép ODbL), tra qua Photon (https://photon.komoot.io).
 * Ngày lấy: 2026-11-06. Mỗi dòng = các đoạn cùng tên trong một phường, tọa độ là trung bình các đoạn (độ chính xác: mức đường).
 * Dùng khi khách gõ tên đường mà chưa gõ khu, để 4 gợi ý đầu đủ các quận cũ khác nhau.
 */
export interface HcmStreetSegment {
  street: string;
  /** Phường/Xã mới (có thể rỗng nếu OSM không ghi) */
  ward: string;
  /** Quận/Huyện cũ */
  district: string;
  lat: number;
  lng: number;
  /** Mã đối tượng OSM của các đoạn đã gom (way/relation) */
  osmIds: string[];
}

export const HCM_STREET_SEGMENTS_SOURCE = {
  source: 'OpenStreetMap (ODbL) qua Photon',
  url: "https://photon.komoot.io",
  fetchedAt: "2026-11-06",
} as const;

export const HCM_STREET_SEGMENTS: HcmStreetSegment[] = [
  {
    "street": "Hai Bà Trưng",
    "ward": "Phường Sài Gòn",
    "district": "Quận 1",
    "lat": 10.778532,
    "lng": 106.702897,
    "osmIds": [
      "W1218900523",
      "W1265997659",
      "W1343964590",
      "W326848006",
      "W35114854",
      "W863689512"
    ]
  },
  {
    "street": "Hai Bà Trưng",
    "ward": "Phường Tân Định",
    "district": "Quận 1",
    "lat": 10.790149,
    "lng": 106.689201,
    "osmIds": [
      "W1345417677",
      "W1443551463",
      "W224445489"
    ]
  },
  {
    "street": "Hai Bà Trưng",
    "ward": "Phường Xuân Hòa",
    "district": "Quận 3",
    "lat": 10.787914,
    "lng": 106.691885,
    "osmIds": [
      "W1178198378",
      "W1345417676",
      "W1431332944",
      "W1443551462",
      "W306641038",
      "W673254417"
    ]
  },
  {
    "street": "Hai Bà Trưng",
    "ward": "Phường Đông Hòa",
    "district": "TP. Dĩ An",
    "lat": 10.896445,
    "lng": 106.778377,
    "osmIds": [
      "W1351990049",
      "W1351990050",
      "W291139307"
    ]
  },
  {
    "street": "Hai Bà Trưng",
    "ward": "Phường Thủ Dầu Một",
    "district": "TP. Thủ Dầu Một",
    "lat": 10.976213,
    "lng": 106.652056,
    "osmIds": [
      "W224851555"
    ]
  },
  {
    "street": "Hai Bà Trưng",
    "ward": "Phường Tăng Nhơn Phú",
    "district": "TP. Thủ Đức",
    "lat": 10.842511,
    "lng": 106.774106,
    "osmIds": [
      "W32575896"
    ]
  },
  {
    "street": "Lê Hồng Phong",
    "ward": "Phường Hòa Hưng",
    "district": "Quận 10",
    "lat": 10.771362,
    "lng": 106.672792,
    "osmIds": [
      "W470511619",
      "W585932708",
      "W817504916"
    ]
  },
  {
    "street": "Lê Hồng Phong",
    "ward": "Phường Vườn Lài",
    "district": "Quận 10",
    "lat": 10.766626,
    "lng": 106.674782,
    "osmIds": [
      "W719474411",
      "W817504914"
    ]
  },
  {
    "street": "Lê Hồng Phong",
    "ward": "Phường Chợ Quán",
    "district": "Quận 5",
    "lat": 10.759707,
    "lng": 106.677243,
    "osmIds": [
      "N9052922920",
      "W468616402",
      "W724472695",
      "W971692817"
    ]
  },
  {
    "street": "Lê Hồng Phong",
    "ward": "Phường Dĩ An",
    "district": "TP. Dĩ An",
    "lat": 10.922986,
    "lng": 106.766139,
    "osmIds": [
      "W225119781"
    ]
  },
  {
    "street": "Lê Hồng Phong",
    "ward": "Phường Tân Đông Hiệp",
    "district": "TP. Dĩ An",
    "lat": 10.933979,
    "lng": 106.752933,
    "osmIds": [
      "W1222914177"
    ]
  },
  {
    "street": "Lê Hồng Phong",
    "ward": "Phường Phú Lợi",
    "district": "TP. Thủ Dầu Một",
    "lat": 10.990712,
    "lng": 106.674011,
    "osmIds": [
      "W225060909"
    ]
  },
  {
    "street": "Lê Hồng Phong",
    "ward": "Phường Thủ Dầu Một",
    "district": "TP. Thủ Dầu Một",
    "lat": 10.960678,
    "lng": 106.673293,
    "osmIds": [
      "W1333473015",
      "W145623500"
    ]
  },
  {
    "street": "Lê Lai",
    "ward": "Thị trấn Hóc Môn",
    "district": "Huyện Hóc Môn",
    "lat": 10.888683,
    "lng": 106.59655,
    "osmIds": [
      "W1017695736",
      "W32583795"
    ]
  },
  {
    "street": "Lê Lai",
    "ward": "Phường Bến Thành",
    "district": "Quận 1",
    "lat": 10.769681,
    "lng": 106.692992,
    "osmIds": [
      "W1132278756",
      "W1185425438",
      "W1265213606",
      "W1289160316",
      "W245571623",
      "W326770977"
    ]
  },
  {
    "street": "Lê Lai",
    "ward": "Phường Hạnh Thông",
    "district": "Quận Gò Vấp",
    "lat": 10.817711,
    "lng": 106.684486,
    "osmIds": [
      "N11787220774",
      "W639012126"
    ]
  },
  {
    "street": "Lê Lai",
    "ward": "Phường Bảy Hiền",
    "district": "Quận Tân Bình",
    "lat": 10.794419,
    "lng": 106.645768,
    "osmIds": [
      "W523162208",
      "W693372084"
    ]
  },
  {
    "street": "Lê Lai",
    "ward": "Phường Bình Dương",
    "district": "TP. Bến Cát",
    "lat": 11.100096,
    "lng": 106.681549,
    "osmIds": [
      "W226103386"
    ]
  },
  {
    "street": "Lê Lai",
    "ward": "Phường Hòa Lợi",
    "district": "TP. Bến Cát",
    "lat": 11.096763,
    "lng": 106.666612,
    "osmIds": [
      "W1334392509"
    ]
  },
  {
    "street": "Lê Lợi",
    "ward": "Thị trấn Hóc Môn",
    "district": "Huyện Hóc Môn",
    "lat": 10.8997,
    "lng": 106.576758,
    "osmIds": [
      "W1409147726",
      "W607215908"
    ]
  },
  {
    "street": "Lê Lợi",
    "ward": "Xã Bà Điểm",
    "district": "Huyện Hóc Môn",
    "lat": 10.861832,
    "lng": 106.609411,
    "osmIds": [
      "W1177773797",
      "W32587834"
    ]
  },
  {
    "street": "Lê Lợi",
    "ward": "Xã Xuân Thới Sơn",
    "district": "Huyện Hóc Môn",
    "lat": 10.881538,
    "lng": 106.591555,
    "osmIds": [
      "W199222892",
      "W32585293"
    ]
  },
  {
    "street": "Lê Lợi",
    "ward": "Phường Bến Thành",
    "district": "Quận 1",
    "lat": 10.772975,
    "lng": 106.699737,
    "osmIds": [
      "W1296762105",
      "W215508254"
    ]
  },
  {
    "street": "Lê Lợi",
    "ward": "Phường Sài Gòn",
    "district": "Quận 1",
    "lat": 10.7749,
    "lng": 106.701536,
    "osmIds": [
      "W1056576715",
      "W1232849514",
      "W1232849515",
      "W175542687",
      "W193085735"
    ]
  },
  {
    "street": "Lê Lợi",
    "ward": "Phường Hạnh Thông",
    "district": "Quận Gò Vấp",
    "lat": 10.819455,
    "lng": 106.68661,
    "osmIds": [
      "N11789253340",
      "W1311157512"
    ]
  },
  {
    "street": "Lê Lợi",
    "ward": "Phường Bình Dương",
    "district": "TP. Bến Cát",
    "lat": 11.058784,
    "lng": 106.68027,
    "osmIds": [
      "W1333472999",
      "W1334392510",
      "W1446433937"
    ]
  },
  {
    "street": "Lê Lợi",
    "ward": "Phường Thủ Dầu Một",
    "district": "TP. Thủ Dầu Một",
    "lat": 10.979869,
    "lng": 106.652966,
    "osmIds": [
      "W263643102"
    ]
  },
  {
    "street": "Lê Lợi",
    "ward": "Phường Tăng Nhơn Phú",
    "district": "TP. Thủ Đức",
    "lat": 10.846504,
    "lng": 106.775181,
    "osmIds": [
      "W224494489"
    ]
  },
  {
    "street": "Lê Văn Thọ",
    "ward": "Phường An Hội Đông",
    "district": "Quận Gò Vấp",
    "lat": 10.851762,
    "lng": 106.656114,
    "osmIds": [
      "W1291967765"
    ]
  },
  {
    "street": "Lê Văn Thọ",
    "ward": "Phường An Hội Tây",
    "district": "Quận Gò Vấp",
    "lat": 10.8548,
    "lng": 106.655932,
    "osmIds": [
      "W705711893"
    ]
  },
  {
    "street": "Lê Văn Thọ",
    "ward": "Phường Thông Tây Hội",
    "district": "Quận Gò Vấp",
    "lat": 10.840622,
    "lng": 106.657515,
    "osmIds": [
      "W1265704883",
      "W215350719",
      "W32587044"
    ]
  },
  {
    "street": "Nguyễn Du",
    "ward": "Phường Bến Thành",
    "district": "Quận 1",
    "lat": 10.773935,
    "lng": 106.694888,
    "osmIds": [
      "W1328367384",
      "W329878185"
    ]
  },
  {
    "street": "Nguyễn Du",
    "ward": "Phường Sài Gòn",
    "district": "Quận 1",
    "lat": 10.781867,
    "lng": 106.70157,
    "osmIds": [
      "W1187537970",
      "W1343964594",
      "W732571882"
    ]
  },
  {
    "street": "Nguyễn Du",
    "ward": "Phường Hạnh Thông",
    "district": "Quận Gò Vấp",
    "lat": 10.827609,
    "lng": 106.685378,
    "osmIds": [
      "W1092251178",
      "W32585245",
      "W453657574"
    ]
  },
  {
    "street": "Nguyễn Du",
    "ward": "Phường Phú Thọ Hòa",
    "district": "Quận Tân Phú",
    "lat": 10.790523,
    "lng": 106.623283,
    "osmIds": [
      "W256404553"
    ]
  },
  {
    "street": "Nguyễn Du",
    "ward": "Phường Dĩ An",
    "district": "TP. Dĩ An",
    "lat": 10.911329,
    "lng": 106.765597,
    "osmIds": [
      "W615070325",
      "W615130357",
      "W835622537"
    ]
  },
  {
    "street": "Nguyễn Du",
    "ward": "Phường Đông Hòa",
    "district": "TP. Dĩ An",
    "lat": 10.880418,
    "lng": 106.788929,
    "osmIds": [
      "W1489694998",
      "W290318808"
    ]
  },
  {
    "street": "Nguyễn Du",
    "ward": "Phường Thủ Dầu Một",
    "district": "TP. Thủ Dầu Một",
    "lat": 10.980614,
    "lng": 106.654404,
    "osmIds": [
      "W264451910"
    ]
  },
  {
    "street": "Nguyễn Du",
    "ward": "Phường Tăng Nhơn Phú",
    "district": "TP. Thủ Đức",
    "lat": 10.844634,
    "lng": 106.77379,
    "osmIds": [
      "W723244987"
    ]
  },
  {
    "street": "Nguyễn Du",
    "ward": "Phường An Phú",
    "district": "TP. Thuận An",
    "lat": 10.929012,
    "lng": 106.74191,
    "osmIds": [
      "W1370334734"
    ]
  },
  {
    "street": "Nguyễn Du",
    "ward": "Phường Bình Hòa",
    "district": "TP. Thuận An",
    "lat": 10.919527,
    "lng": 106.733143,
    "osmIds": [
      "W146053587"
    ]
  },
  {
    "street": "Nguyễn Trãi",
    "ward": "Phường Bến Thành",
    "district": "Quận 1",
    "lat": 10.769457,
    "lng": 106.690955,
    "osmIds": [
      "N11628663569",
      "W1185424339",
      "W35115101"
    ]
  },
  {
    "street": "Nguyễn Trãi",
    "ward": "Phường Cầu Ông Lãnh",
    "district": "Quận 1",
    "lat": 10.763103,
    "lng": 106.686253,
    "osmIds": [
      "N6315685296",
      "W289968625",
      "W472411140",
      "W718499095"
    ]
  },
  {
    "street": "Nguyễn Trãi",
    "ward": "Phường An Đông",
    "district": "Quận 5",
    "lat": 10.754938,
    "lng": 106.67098,
    "osmIds": [
      "W719020365",
      "W719415670",
      "W719467560",
      "W719467562"
    ]
  },
  {
    "street": "Nguyễn Trãi",
    "ward": "Phường Chợ Lớn",
    "district": "Quận 5",
    "lat": 10.753321,
    "lng": 106.657633,
    "osmIds": [
      "W326848017",
      "W720311488"
    ]
  },
  {
    "street": "Nguyễn Trãi",
    "ward": "Phường Chợ Quán",
    "district": "Quận 5",
    "lat": 10.758004,
    "lng": 106.680223,
    "osmIds": [
      "W1268643588",
      "W1463054096"
    ]
  },
  {
    "street": "Nguyễn Trãi",
    "ward": "Phường Dĩ An",
    "district": "TP. Dĩ An",
    "lat": 10.907054,
    "lng": 106.758051,
    "osmIds": [
      "W137036047"
    ]
  },
  {
    "street": "Nguyễn Trãi",
    "ward": "Phường Thủ Dầu Một",
    "district": "TP. Thủ Dầu Một",
    "lat": 10.97949,
    "lng": 106.654798,
    "osmIds": [
      "W126156297",
      "W613651461"
    ]
  },
  {
    "street": "Nguyễn Trãi",
    "ward": "Phường Tăng Nhơn Phú",
    "district": "TP. Thủ Đức",
    "lat": 10.844513,
    "lng": 106.774803,
    "osmIds": [
      "W32586934"
    ]
  },
  {
    "street": "Nguyễn Trãi",
    "ward": "Phường Lái Thiêu",
    "district": "TP. Thuận An",
    "lat": 10.902022,
    "lng": 106.706435,
    "osmIds": [
      "W1007896303"
    ]
  },
  {
    "street": "Phạm Ngũ Lão",
    "ward": "Phường Bến Thành",
    "district": "Quận 1",
    "lat": 10.768234,
    "lng": 106.692164,
    "osmIds": [
      "W1132333807",
      "W1174192434",
      "W1218693155",
      "W285894645",
      "W724042273"
    ]
  },
  {
    "street": "Phạm Ngũ Lão",
    "ward": "Phường Hạnh Thông",
    "district": "Quận Gò Vấp",
    "lat": 10.822948,
    "lng": 106.681785,
    "osmIds": [
      "W537911725",
      "W55880130"
    ]
  },
  {
    "street": "Phạm Ngũ Lão",
    "ward": "Phường Dĩ An",
    "district": "TP. Dĩ An",
    "lat": 10.903196,
    "lng": 106.762237,
    "osmIds": [
      "W323613697",
      "W323613733"
    ]
  },
  {
    "street": "Phạm Ngũ Lão",
    "ward": "Phường Thủ Dầu Một",
    "district": "TP. Thủ Dầu Một",
    "lat": 10.985794,
    "lng": 106.655174,
    "osmIds": [
      "W224851431",
      "W234901540"
    ]
  },
  {
    "street": "Phan Văn Trị",
    "ward": "Phường An Đông",
    "district": "Quận 5",
    "lat": 10.75444,
    "lng": 106.673895,
    "osmIds": [
      "W1185266083"
    ]
  },
  {
    "street": "Phan Văn Trị",
    "ward": "Phường Chợ Quán",
    "district": "Quận 5",
    "lat": 10.757284,
    "lng": 106.682485,
    "osmIds": [
      "N3171506754",
      "W1065782044",
      "W1177473819",
      "W152993857"
    ]
  },
  {
    "street": "Phan Văn Trị",
    "ward": "Phường Bình Lợi Trung",
    "district": "Quận Bình Thạnh",
    "lat": 10.816191,
    "lng": 106.694835,
    "osmIds": [
      "W1280070565",
      "W604830682",
      "W724381197",
      "W817513031"
    ]
  },
  {
    "street": "Phan Văn Trị",
    "ward": "Phường Bình Thạnh",
    "district": "Quận Bình Thạnh",
    "lat": 10.808346,
    "lng": 106.697016,
    "osmIds": [
      "W32581932",
      "W32584299"
    ]
  },
  {
    "street": "Phan Văn Trị",
    "ward": "Phường An Nhơn",
    "district": "Quận Gò Vấp",
    "lat": 10.824852,
    "lng": 106.690781,
    "osmIds": [
      "W446937582"
    ]
  },
  {
    "street": "Phan Văn Trị",
    "ward": "Phường Gò Vấp",
    "district": "Quận Gò Vấp",
    "lat": 10.834518,
    "lng": 106.667406,
    "osmIds": [
      "W1421144789",
      "W1421144790",
      "W446937576"
    ]
  },
  {
    "street": "Phan Văn Trị",
    "ward": "Phường Hạnh Thông",
    "district": "Quận Gò Vấp",
    "lat": 10.8265,
    "lng": 106.686657,
    "osmIds": [
      "W1092251177",
      "W446937578",
      "W688879176",
      "W724058962"
    ]
  },
  {
    "street": "Quang Trung",
    "ward": "Thị trấn Hóc Môn",
    "district": "Huyện Hóc Môn",
    "lat": 10.888356,
    "lng": 106.596839,
    "osmIds": [
      "W1017695734",
      "W1320104773"
    ]
  },
  {
    "street": "Quang Trung",
    "ward": "Xã Bà Điểm",
    "district": "Huyện Hóc Môn",
    "lat": 10.862288,
    "lng": 106.609929,
    "osmIds": [
      "W417275842"
    ]
  },
  {
    "street": "Quang Trung",
    "ward": "Xã Đông Thạnh",
    "district": "Huyện Hóc Môn",
    "lat": 10.888028,
    "lng": 106.600224,
    "osmIds": [
      "W1017695733"
    ]
  },
  {
    "street": "Quang Trung",
    "ward": "Phường Đông Hưng Thuận",
    "district": "Quận 12",
    "lat": 10.846924,
    "lng": 106.634529,
    "osmIds": [
      "N11799722435",
      "W399152054"
    ]
  },
  {
    "street": "Quang Trung",
    "ward": "Phường An Hội Tây",
    "district": "Quận Gò Vấp",
    "lat": 10.845698,
    "lng": 106.638115,
    "osmIds": [
      "W1152817910",
      "W211081624",
      "W240901845"
    ]
  },
  {
    "street": "Quang Trung",
    "ward": "Phường Gò Vấp",
    "district": "Quận Gò Vấp",
    "lat": 10.829022,
    "lng": 106.67409,
    "osmIds": [
      "W721740699",
      "W817129222"
    ]
  },
  {
    "street": "Quang Trung",
    "ward": "Phường Hạnh Thông",
    "district": "Quận Gò Vấp",
    "lat": 10.826676,
    "lng": 106.679269,
    "osmIds": [
      "W721740700",
      "W721740701"
    ]
  },
  {
    "street": "Quang Trung",
    "ward": "Phường Thông Tây Hội",
    "district": "Quận Gò Vấp",
    "lat": 10.83824,
    "lng": 106.652685,
    "osmIds": [
      "W1213249644",
      "W1213249648",
      "W1225665118",
      "W1308759071",
      "W217609237",
      "W217609238",
      "W217609239"
    ]
  },
  {
    "street": "Quang Trung",
    "ward": "Phường Thủ Dầu Một",
    "district": "TP. Thủ Dầu Một",
    "lat": 10.980371,
    "lng": 106.652201,
    "osmIds": [
      "W126154661"
    ]
  },
  {
    "street": "Quang Trung",
    "ward": "Phường Tăng Nhơn Phú",
    "district": "TP. Thủ Đức",
    "lat": 10.840394,
    "lng": 106.772941,
    "osmIds": [
      "W1205669499",
      "W1344344445",
      "W306170805",
      "W32585693",
      "W606920724",
      "W722357078"
    ]
  },
  {
    "street": "Trần Hưng Đạo",
    "ward": "Thị trấn Hóc Môn",
    "district": "Huyện Hóc Môn",
    "lat": 10.884475,
    "lng": 106.596161,
    "osmIds": [
      "W604865208",
      "W846138566"
    ]
  },
  {
    "street": "Trần Hưng Đạo",
    "ward": "Phường Bến Thành",
    "district": "Quận 1",
    "lat": 10.767597,
    "lng": 106.694933,
    "osmIds": [
      "W1019648664",
      "W722054810",
      "W723868605"
    ]
  },
  {
    "street": "Trần Hưng Đạo",
    "ward": "Phường Cầu Ông Lãnh",
    "district": "Quận 1",
    "lat": 10.761818,
    "lng": 106.690006,
    "osmIds": [
      "W1019648604",
      "W1019648637",
      "W1019648648",
      "W696114974",
      "W724091817"
    ]
  },
  {
    "street": "Trần Hưng Đạo",
    "ward": "Phường An Đông",
    "district": "Quận 5",
    "lat": 10.75304,
    "lng": 106.670903,
    "osmIds": [
      "W1019648617",
      "W1353099461",
      "W1394917840",
      "W719961763"
    ]
  },
  {
    "street": "Trần Hưng Đạo",
    "ward": "Phường Chợ Lớn",
    "district": "Quận 5",
    "lat": 10.752099,
    "lng": 106.660169,
    "osmIds": [
      "W1226372884",
      "W1291979755",
      "W1394918558",
      "W720034787"
    ]
  },
  {
    "street": "Trần Hưng Đạo",
    "ward": "Phường Chợ Quán",
    "district": "Quận 5",
    "lat": 10.755908,
    "lng": 106.683304,
    "osmIds": [
      "W1019648630",
      "W1280794110",
      "W227746179",
      "W327048057"
    ]
  },
  {
    "street": "Trần Hưng Đạo",
    "ward": "Phường Tân Sơn Nhì",
    "district": "Quận Tân Phú",
    "lat": 10.795364,
    "lng": 106.636337,
    "osmIds": [
      "W32587726"
    ]
  },
  {
    "street": "Trần Hưng Đạo",
    "ward": "Phường Đông Hòa",
    "district": "TP. Dĩ An",
    "lat": 10.900174,
    "lng": 106.779044,
    "osmIds": [
      "W568398688"
    ]
  },
  {
    "street": "Trần Hưng Đạo",
    "ward": "Phường Thủ Dầu Một",
    "district": "TP. Thủ Dầu Một",
    "lat": 10.979915,
    "lng": 106.653514,
    "osmIds": [
      "W234901544"
    ]
  },
  {
    "street": "Trần Hưng Đạo",
    "ward": "Phường Tăng Nhơn Phú",
    "district": "TP. Thủ Đức",
    "lat": 10.845086,
    "lng": 106.77422,
    "osmIds": [
      "W1154975450",
      "W224494492",
      "W32577544"
    ]
  },
  {
    "street": "Trần Phú",
    "ward": "Phường An Đông",
    "district": "Quận 5",
    "lat": 10.754612,
    "lng": 106.671366,
    "osmIds": [
      "N11811394802",
      "N4621858713",
      "W1394917841",
      "W32579758",
      "W718984419",
      "W723846593"
    ]
  },
  {
    "street": "Trần Phú",
    "ward": "Phường Chợ Quán",
    "district": "Quận 5",
    "lat": 10.760788,
    "lng": 106.677352,
    "osmIds": [
      "W1253458369",
      "W330374295",
      "W971692816"
    ]
  },
  {
    "street": "Trần Phú",
    "ward": "Phường Thủ Dầu Một",
    "district": "TP. Thủ Dầu Một",
    "lat": 10.973512,
    "lng": 106.665116,
    "osmIds": [
      "W224839350"
    ]
  }
];
