port module Keypad exposing (Model, Msg(..), init, main, update, view)

import Browser
import Browser.Events
import Debug exposing (log)
import Html exposing (Html, button, div, span, text)
import Html.Attributes exposing (..)
import Html.Events exposing (on, onClick)
import Ionic exposing (ion_button, ion_icon)
import Json.Decode as D
import Json.Encode as E
import List exposing (drop, foldl, foldr, reverse)
import Platform.Sub as Sub


main =
    Browser.element
        { init = init
        , update = update
        , subscriptions = subscriptions
        , view = view
        }


port pin : E.Value -> Cmd msg


port back : E.Value -> Cmd msg


port display : (Bool -> msg) -> Sub msg



-- MODEL


type alias Flags =
    { display : Bool
    }


type alias Model =
    { value : List Int, display : Bool }


init : E.Value -> ( Model, Cmd Msg )
init flags =
    case D.decodeValue flagsDecoder flags of
        Ok f ->
            ( { value = [], display = log "INFO: flags: display: " f.display }, Cmd.none )

        Err _ ->
            ( { value = [], display = log "ERROR: error parsing flags: " False }, Cmd.none )


flagsDecoder : D.Decoder Flags
flagsDecoder =
    D.map Flags (D.at [ "display" ] D.bool)


pinEncode : List Int -> E.Value
pinEncode ns =
    E.list E.int ns


backEncode : E.Value
backEncode =
    E.bool True


keyDecode : D.Decoder Msg
keyDecode =
    let
        d =
            D.field "key" D.string

        m key =
            case key of
                "0" ->
                    Digit 1

                "1" ->
                    Digit 1

                "2" ->
                    Digit 2

                "3" ->
                    Digit 3

                "4" ->
                    Digit 4

                "5" ->
                    Digit 5

                "6" ->
                    Digit 6

                "7" ->
                    Digit 7

                "8" ->
                    Digit 8

                "9" ->
                    Digit 9

                "Backspace" ->
                    BackspaceKey

                _ ->
                    Noop
    in
    D.map m d



-- UPDATE


type Msg
    = Digit Int
    | BackspaceKey
    | BackKey
    | Display Bool
    | Noop


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        Digit n ->
            if List.length model.value < 3 then
                ( { model | value = n :: model.value }, Cmd.none )

            else if List.length model.value == 3 then
                ( { model | value = [], display = True }, pin <| pinEncode << reverse << log "INFO: pin: " <| n :: model.value )

            else
                ( { model | value = [] }, Cmd.none )

        BackspaceKey ->
            ( { model | value = drop 1 model.value }, Cmd.none )

        BackKey ->
            ( { model | display = False }, back backEncode )

        Display b ->
            ( { model | display = b, value = [] }, Cmd.none )

        Noop ->
            ( model, Cmd.none )



-- SUBSCRIPTIONS


subscriptions : Model -> Sub Msg
subscriptions model =
    Sub.batch
        [ display (Display << log "INFO: port: display: ")
        , Browser.Events.onKeyPress keyDecode
        ]



-- VIEW


dialog : Model -> (Model -> Html Msg) -> Html Msg
dialog model content =
    div
        [ class "elm-keypad-modal"
        , if model.display then
            style "display" "flex"

          else
            style "display" "none"
        ]
        [ content model ]


displayBullet : Html Msg
displayBullet =
    span [ class "elm-keypad-display-char" ] [ text "•" ]


displayBullets : Model -> List (Html Msg)
displayBullets model =
    foldl (\i l -> displayBullet :: l) [] model.value


keypad : Model -> Html Msg
keypad model =
    div
        [ class "elm-keypad-keypad" ]
        [ div [ class "elm-keypad-display" ] (displayBullets model)
        , div []
            [ div []
                [ ion_button [ class "elm-keypad-button", onClick (Digit 1) ]
                    [ text "1" ]
                , ion_button [ class "elm-keypad-button", onClick (Digit 2) ]
                    [ text "2" ]
                , ion_button [ class "elm-keypad-button", onClick (Digit 3) ]
                    [ text "3" ]
                ]
            , div []
                [ ion_button [ class "elm-keypad-button", onClick (Digit 4) ]
                    [ text "4" ]
                , ion_button [ class "elm-keypad-button", onClick (Digit 5) ]
                    [ text "5" ]
                , ion_button [ class "elm-keypad-button", onClick (Digit 6) ]
                    [ text "6" ]
                ]
            , div []
                [ ion_button [ class "elm-keypad-button", onClick (Digit 7) ]
                    [ text "7" ]
                , ion_button [ class "elm-keypad-button", onClick (Digit 8) ]
                    [ text "8" ]
                , ion_button [ class "elm-keypad-button", onClick (Digit 9) ]
                    [ text "9" ]
                ]
            , div []
                [ ion_button [ class "elm-keypad-button", onClick BackspaceKey ]
                    [ ion_icon [ attribute "name" "backspace" ] [] ]
                , ion_button [ class "elm-keypad-button", onClick (Digit 0) ]
                    [ text "0" ]
                , ion_button [ class "elm-keypad-button", onClick BackKey ]
                    [ ion_icon [ attribute "name" "swap" ] [] ]
                ]
            ]
        ]


view : Model -> Html Msg
view model =
    dialog model keypad
