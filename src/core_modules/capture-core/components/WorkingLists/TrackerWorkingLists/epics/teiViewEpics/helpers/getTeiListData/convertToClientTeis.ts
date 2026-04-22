import { convertServerToClient } from '../../../../../../../converters';
import type { ApiTeis, ApiTeiAttributes, TeiColumnsMetaForDataFetchingArray, ClientTeis } from './types';
import { RECORD_TYPE, buildUrlByElementType } from '../getListDataCommon';

const RECORD_META_KEYS = {
    enrollmentId: '__enrollmentId',
    orgUnitId: '__orgUnitId',
    teiId: '__teiId',
    programId: '__programId',
} as const;

const getValuesById = (attributeValues: ApiTeiAttributes = []) =>
    attributeValues
        .reduce((acc, { attribute, value }) => {
            acc[attribute] = value;
            return acc;
        }, {});

export const convertToClientTeis = (
    apiTeis: ApiTeis,
    columnsMetaForDataFetching: TeiColumnsMetaForDataFetchingArray,
    programId: string,
): ClientTeis =>
    apiTeis
        .map((tei) => {
            const attributeValuesById = getValuesById(tei.attributes);
            const record = columnsMetaForDataFetching
                .map(({ id, mainProperty, type }) => {
                    let value;
                    if (mainProperty) {
                        value = tei[id];
                    } else {
                        value = attributeValuesById[id];
                    }
                    const urls = buildUrlByElementType[RECORD_TYPE.trackedEntity][type]
                        ? buildUrlByElementType[RECORD_TYPE.trackedEntity][type]({
                            trackedEntity: tei.trackedEntity,
                            id,
                            programId,
                        })
                        : {};

                    return {
                        id,
                        value: convertServerToClient(value, type),
                        ...urls,
                    };
                })
                .filter(({ value }) => value != null)
                .reduce((acc, { id, value, imageUrl, previewUrl, fileUrl }: any) => {
                    acc[id] = {
                        convertedValue: value,
                        fileUrl,
                        ...(imageUrl ? { imageUrl, previewUrl } : {}),
                    };
                    return acc;
                }, {});

            const enrollment = (tei.enrollments || []).find(({ program }) => program === programId)
                || tei.enrollments?.[0];
            if (enrollment?.enrollment) {
                record[RECORD_META_KEYS.enrollmentId] = enrollment.enrollment;
            }
            if (enrollment?.orgUnit) {
                record[RECORD_META_KEYS.orgUnitId] = enrollment.orgUnit;
            }
            record[RECORD_META_KEYS.teiId] = tei.trackedEntity;
            record[RECORD_META_KEYS.programId] = programId;

            const programOwner = tei.programOwners.find(({ program }) => program === programId)?.orgUnit;
            if (programOwner) {
                record.programOwnerId = programOwner;
                if (!record[RECORD_META_KEYS.orgUnitId]) {
                    record[RECORD_META_KEYS.orgUnitId] = programOwner;
                }
            }

            return {
                id: tei.trackedEntity,
                record,
            };
        });
