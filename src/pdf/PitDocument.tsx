import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from '@react-pdf/renderer';
import type { PitRecord } from '../types';
import { buildPageGroups, formatBool, calcDuration } from './pdfUtils';

// フォントURL解決（GitHub Pagesのサブパス /pit_sagyou_kiroku/ にも対応）
// window.location.href を基準にすることで、どの環境でも正しく解決される
// 例: https://sakupan-syuzo.github.io/pit_sagyou_kiroku/BIZUDPGothic-Regular.ttf
const getFontUrl = (filename: string): string => {
  if (typeof window !== 'undefined') {
    return new URL(filename, window.location.href).href;
  }
  return `/${filename}`;
};

// フォント登録
Font.register({
  family: 'BIZUDPGothic',
  fonts: [
    { src: getFontUrl('BIZUDPGothic-Regular.ttf'), fontWeight: 'normal' },
    { src: getFontUrl('BIZUDPGothic-Bold.ttf'), fontWeight: 'bold' },
  ],
});

// ハイフネーション無効化
Font.registerHyphenationCallback((word) => [word]);

const FONT = 'BIZUDPGothic';

const styles = StyleSheet.create({
  page: {
    fontFamily: FONT,
    fontSize: 8,
    paddingTop: 36,
    paddingBottom: 50,
    paddingHorizontal: 28,
    backgroundColor: '#ffffff',
  },
  // ヘッダー
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1.5,
    borderBottomColor: '#1e3a5f',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: FONT,
    color: '#1e3a5f',
  },
  headerSub: {
    fontSize: 9,
    color: '#555',
    fontFamily: FONT,
    marginTop: 2,
  },
  headerPageInfo: {
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: FONT,
    color: '#1e3a5f',
    textAlign: 'right',
  },
  // テーブル
  table: {
    width: '100%',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ccc',
    backgroundColor: '#f7f9fc',
  },
  // セル共通
  cell: {
    paddingVertical: 3,
    paddingHorizontal: 3,
    borderRightWidth: 0.5,
    borderRightColor: '#ccc',
    justifyContent: 'center',
  },
  cellText: {
    fontFamily: FONT,
    fontSize: 7.5,
    color: '#222',
  },
  headerCellText: {
    fontFamily: FONT,
    fontSize: 7,
    fontWeight: 'bold',
    color: '#fff',
  },
  // 列幅定義 (合計100%)
  colNo: { width: '4%' },
  colPitNo: { width: '5%' },
  colCarNo: { width: '5%' },
  colPitInTime: { width: '9%' },
  colPitOutTime: { width: '9%' },
  colDuration: { width: '8%' },
  colPitInDriver: { width: '7%' },
  colPitOutDriver: { width: '7%' },
  colDriverChange: { width: '6%' },
  colRefuel: { width: '6%' },
  colTires: { width: '6%' },
  colOther: { width: '28%' },
  // フッター
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 28,
    right: 28,
    borderTopWidth: 0.5,
    borderTopColor: '#aaa',
    paddingTop: 6,
    flexDirection: 'row',
    gap: 20,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 4,
  },
  footerLabel: {
    fontSize: 7.5,
    fontFamily: FONT,
    color: '#333',
  },
  footerValue: {
    fontSize: 8,
    fontFamily: FONT,
    fontWeight: 'bold',
    color: '#111',
    borderBottomWidth: 0.5,
    borderBottomColor: '#000',
    minWidth: 80,
    paddingBottom: 1,
  },
});

const COLUMNS = [
  { key: 'no', label: '#', style: styles.colNo },
  { key: 'pitNo', label: 'PIT\nNo.', style: styles.colPitNo },
  { key: 'carNo', label: 'Car\nNo.', style: styles.colCarNo },
  { key: 'pitInTime', label: 'PIT IN\n時刻', style: styles.colPitInTime },
  { key: 'pitOutTime', label: 'PIT OUT\n時刻', style: styles.colPitOutTime },
  { key: 'duration', label: '滞在\n時間', style: styles.colDuration },
  { key: 'pitInDriver', label: 'IN Dr.', style: styles.colPitInDriver },
  { key: 'pitOutDriver', label: 'OUT Dr.', style: styles.colPitOutDriver },
  { key: 'driverChange', label: '交代', style: styles.colDriverChange },
  { key: 'refuel', label: '給油', style: styles.colRefuel },
  { key: 'tires', label: 'タイヤ', style: styles.colTires },
  { key: 'other', label: 'その他作業', style: styles.colOther },
];

interface PitDocumentProps {
  records: PitRecord[];
  sessionName: string;
  inspector: string;
}

const FooterLine: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.footerItem}>
    <Text style={styles.footerLabel}>{label}:</Text>
    <Text style={styles.footerValue}>
      {value || ''}
    </Text>
  </View>
);

const PitDocument: React.FC<PitDocumentProps> = ({ records, sessionName, inspector }) => {
  const pageGroups = buildPageGroups(records);

  if (pageGroups.length === 0) {
    return (
      <Document>
        <Page size="A4" orientation="portrait" style={styles.page}>
          <Text style={{ fontFamily: FONT, fontSize: 12, color: '#888' }}>
            作業記録がありません
          </Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {pageGroups.map((pg, pgIdx) => (
        <Page key={pgIdx} size="A4" orientation="portrait" style={styles.page}>
          {/* ヘッダー */}
          <View style={styles.header} fixed>
            <View>
              <Text style={styles.headerTitle}>
                ピット作業記録　Car No. {pg.carNo}
              </Text>
              {sessionName ? (
                <Text style={styles.headerSub}>セッション: {sessionName}</Text>
              ) : null}
            </View>
            <Text style={styles.headerPageInfo}>
              Car No. {pg.carNo}　{pg.pageIndex}/{pg.totalPages}
            </Text>
          </View>

          {/* テーブル */}
          <View style={styles.table}>
            {/* テーブルヘッダー */}
            <View style={styles.tableHeaderRow} fixed>
              {COLUMNS.map((col) => (
                <View key={col.key} style={[styles.cell, col.style]}>
                  <Text style={styles.headerCellText}>{col.label}</Text>
                </View>
              ))}
            </View>

            {/* データ行 */}
            {pg.records.map((record, rowIdx) => {
              const isAlt = rowIdx % 2 === 1;
              const rowStyle = isAlt ? styles.tableRowAlt : styles.tableRow;
              // グループ内での通し番号
              const globalRowNo =
                (pg.pageIndex - 1) * 20 + rowIdx + 1;

              return (
                <View key={record.id} style={rowStyle} wrap={false}>
                  {/* # */}
                  <View style={[styles.cell, styles.colNo]}>
                    <Text style={styles.cellText}>{globalRowNo}</Text>
                  </View>
                  {/* PIT No. */}
                  <View style={[styles.cell, styles.colPitNo]}>
                    <Text style={styles.cellText}>{record.pitNo}</Text>
                  </View>
                  {/* Car No. */}
                  <View style={[styles.cell, styles.colCarNo]}>
                    <Text style={{ ...styles.cellText, fontWeight: 'bold' }}>{record.carNo}</Text>
                  </View>
                  {/* PIT IN時刻 */}
                  <View style={[styles.cell, styles.colPitInTime]}>
                    <Text style={styles.cellText}>{record.pitInTime}</Text>
                  </View>
                  {/* PIT OUT時刻 */}
                  <View style={[styles.cell, styles.colPitOutTime]}>
                    <Text style={styles.cellText}>{record.pitOutTime || ''}</Text>
                  </View>
                  {/* 滞在時間 */}
                  <View style={[styles.cell, styles.colDuration]}>
                    <Text style={styles.cellText}>{calcDuration(record.pitInAt, record.pitOutAt)}</Text>
                  </View>
                  {/* PIT INドライバー */}
                  <View style={[styles.cell, styles.colPitInDriver]}>
                    <Text style={styles.cellText}>{record.pitInDriver}</Text>
                  </View>
                  {/* PIT OUTドライバー */}
                  <View style={[styles.cell, styles.colPitOutDriver]}>
                    <Text style={styles.cellText}>
                      {record.isDriverChanged ? record.pitOutDriver : record.pitInDriver}
                    </Text>
                  </View>
                  {/* ドライバー交代 */}
                  <View style={[styles.cell, styles.colDriverChange]}>
                    <Text style={styles.cellText}>{formatBool(record.isDriverChanged)}</Text>
                  </View>
                  {/* 給油 */}
                  <View style={[styles.cell, styles.colRefuel]}>
                    <Text style={styles.cellText}>{formatBool(record.refuel)}</Text>
                  </View>
                  {/* タイヤ */}
                  <View style={[styles.cell, styles.colTires]}>
                    <Text style={styles.cellText}>{record.tires}</Text>
                  </View>
                  {/* その他 */}
                  <View style={[styles.cell, styles.colOther, { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' }]}>
                    {Array.from(record.other || '').map((char, i) => (
                      <Text key={i} style={styles.cellText}>
                        {char}
                      </Text>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>

          {/* フッター */}
          <View style={styles.footer} fixed>
            <FooterLine
              label="セッション名"
              value={sessionName}
            />
            <FooterLine
              label="担当審判員"
              value={inspector}
            />
          </View>
        </Page>
      ))}
    </Document>
  );
};

export default PitDocument;
