DROP TABLE IF EXISTS "ad_broadcastmessage";
DROP TABLE IF EXISTS "ad_changelog";
DROP TABLE IF EXISTS "ad_client";
DROP TABLE IF EXISTS "ad_column";
DROP TABLE IF EXISTS "ad_note";
DROP TABLE IF EXISTS "ad_org";
DROP TABLE IF EXISTS "ad_role";
DROP TABLE IF EXISTS "ad_table";
DROP TABLE IF EXISTS "ad_user";
DROP TABLE IF EXISTS "ad_user_orgaccess";
DROP TABLE IF EXISTS "c_bpartner";
DROP TABLE IF EXISTS "c_bpartner_location";
DROP TABLE IF EXISTS "m_attribute";
DROP TABLE IF EXISTS "m_attributeset";
DROP TABLE IF EXISTS "m_attributesetinstance";
DROP TABLE IF EXISTS "m_attributeuse";
DROP TABLE IF EXISTS "m_attributevalue";
DROP TABLE IF EXISTS "m_handlingunit";
DROP TABLE IF EXISTS "m_handlingunitline";
DROP TABLE IF EXISTS "m_locator";
DROP TABLE IF EXISTS "m_lot";
DROP TABLE IF EXISTS "m_packinstance";
DROP TABLE IF EXISTS "m_packjob";
DROP TABLE IF EXISTS "m_packjobline";
DROP TABLE IF EXISTS "m_packtype";
DROP TABLE IF EXISTS "m_product";
DROP TABLE IF EXISTS "m_product_po";
DROP TABLE IF EXISTS "m_product_category";
DROP TABLE IF EXISTS "m_storage_product";
DROP TABLE IF EXISTS "m_storageonhand";
DROP TABLE IF EXISTS "m_warehouse";


DROP TABLE IF EXISTS "c_doctype";

DROP TABLE IF EXISTS "__appcache";

DROP TABLE IF EXISTS "keyval";
DROP TABLE IF EXISTS "user_session";

DROP TABLE IF EXISTS "device";

DROP TABLE IF EXISTS "client";
DROP TABLE IF EXISTS "device_transaction";

DROP TABLE IF EXISTS "c_location";
DROP TABLE IF EXISTS "c_contactactivity";
DROP TABLE IF EXISTS "c_opportunity";

DROP TABLE IF EXISTS "m_discountschema";
DROP TABLE IF EXISTS "m_discountschemabreak";
DROP TABLE IF EXISTS "m_pricelist";
DROP TABLE IF EXISTS "m_pricelist_version";
DROP TABLE IF EXISTS "m_productprice";
DROP TABLE IF EXISTS "c_pos";
DROP TABLE IF EXISTS "c_postype";
DROP TABLE IF EXISTS "c_poskey";
DROP TABLE IF EXISTS "c_poskeylayout";
DROP TABLE IF EXISTS "c_uom";
DROP TABLE IF EXISTS "c_uom_trl";
DROP TABLE IF EXISTS "c_uom_conversion";


DROP INDEX IF EXISTS "ad_broadcastmessage_id";
DROP INDEX IF EXISTS "ad_changelog_id";
DROP INDEX IF EXISTS "ad_client_ad_client_id";
DROP INDEX IF EXISTS "ad_column_ad_column_id";
DROP INDEX IF EXISTS "ad_note_ad_note_id";
DROP INDEX IF EXISTS "ad_org_ad_org_id";
DROP INDEX IF EXISTS "ad_role_ad_role_id";
DROP INDEX IF EXISTS "ad_table_ad_table_id";
DROP INDEX IF EXISTS "ad_user_ad_user_id";
DROP INDEX IF EXISTS "c_bpartner_c_bpartner_id";
DROP INDEX IF EXISTS "c_bpartner_location_id";
DROP INDEX IF EXISTS "m_attribute_id";
DROP INDEX IF EXISTS "m_attributeset_id";
DROP INDEX IF EXISTS "m_attributesetinstance_id";
DROP INDEX IF EXISTS "m_attributeuse_pk";
DROP INDEX IF EXISTS "m_attributevalue_id";
DROP INDEX IF EXISTS "m_handlingunit_id";
DROP INDEX IF EXISTS "m_handlingunitline_id";
DROP INDEX IF EXISTS "m_locator_m_locator_id";
DROP INDEX IF EXISTS "m_lot_m_lot_id";
DROP INDEX IF EXISTS "m_packinstance_id";
DROP INDEX IF EXISTS "m_packjob_m_packjob_id";
DROP INDEX IF EXISTS "m_packjobline_id";
DROP INDEX IF EXISTS "m_packtype_id";
DROP INDEX IF EXISTS "m_product_id";
DROP INDEX IF EXISTS "m_product_category_id";
DROP INDEX IF EXISTS "m_storage_product_pk";
DROP INDEX IF EXISTS "m_storageonhand_pk";
DROP INDEX IF EXISTS "m_warehouse_id";
DROP INDEX IF EXISTS "c_doctype_id";